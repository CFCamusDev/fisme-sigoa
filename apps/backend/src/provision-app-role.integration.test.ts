import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runProvisioningAppRole } from './provision-app-role.js';
import { assertTestDatabase, getTestDatabaseUrl } from './test/db/assert-test-database.js';

describe('runProvisioningAppRole Entrypoint (Integration, RS-040, RNF-014)', () => {
  const adminUrl = assertTestDatabase(getTestDatabaseUrl());
  const createdRoles: string[] = [];
  let adminClient: pg.Client;

  beforeAll(async () => {
    adminClient = new pg.Client({ connectionString: adminUrl });
    await adminClient.connect();
  });

  afterAll(async () => {
    for (const role of createdRoles) {
      await adminClient.query(`DROP ROLE IF EXISTS "${role}";`).catch(() => {});
    }
    await adminClient.end();
  });

  it('provisions and verifies the application role through the entrypoint', async () => {
    const username = `sigoa_app_cli_${crypto.randomBytes(4).toString('hex')}`;
    createdRoles.push(username);
    const password = `secure_cli_pass_${crypto.randomBytes(8).toString('hex')}`;

    const env = {
      DATABASE_URL: adminUrl,
      APP_DB_USER: username,
      APP_DB_PASSWORD: password,
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
    };

    const result = await runProvisioningAppRole(env);

    expect(result.user).toBe(username);
    expect(result.action).toBe('CREATED');
  });
});
