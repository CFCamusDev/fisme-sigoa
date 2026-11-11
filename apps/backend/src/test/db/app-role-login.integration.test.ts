import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createAppRoleLogin } from './app-role-login.js';

describe('createAppRoleLogin under concurrency (T-078-10)', () => {
  it('creates and drops many cluster roles at the same time', async () => {
    const sessions = await Promise.all(Array.from({ length: 12 }, () => createAppRoleLogin()));

    try {
      const usernames = sessions.map((session) => session.username);
      expect(new Set(usernames).size).toBe(12);

      const reader = new pg.Client({ connectionString: sessions[0]!.url });
      await reader.connect();
      try {
        const result = await reader.query<{ rolname: string }>(
          'SELECT rolname FROM pg_roles WHERE rolname = ANY($1)',
          [usernames],
        );
        expect(result.rows).toHaveLength(12);
      } finally {
        await reader.end();
      }
    } finally {
      await Promise.all(sessions.map((session) => session.drop()));
    }
  }, 60_000);
});
