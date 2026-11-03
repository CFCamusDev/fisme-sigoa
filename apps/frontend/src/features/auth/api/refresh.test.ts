import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { refreshSession } from './refresh';

const mockValidResponse = {
  accessToken: 'new-jwt-access-token',
  accessTokenExpiresAt: '2026-10-30T10:30:00.000Z',
  refreshTokenExpiresAt: '2026-11-06T10:15:00.000Z',
  user: {
    id: 'usr-123',
    names: 'Carlos',
    firstSurname: 'Pérez',
    secondSurname: null,
    email: 'carlos.perez@untrm.edu.pe',
  },
};

describe('refresh API (T-002-09, CA1)', () => {
  it('posts with credentials and returns the validated session', async () => {
    let called = false;

    server.use(
      http.post('http://localhost:3000/auth/refresh', () => {
        called = true;
        return HttpResponse.json(mockValidResponse, { status: 200 });
      }),
    );

    const result = await refreshSession();

    expect(called).toBe(true);
    expect(result).toEqual(mockValidResponse);
  });

  it('rejects a response that does not match the schema', async () => {
    server.use(
      http.post('http://localhost:3000/auth/refresh', () => {
        return HttpResponse.json(
          {
            accessToken: 'token-without-user',
          },
          { status: 200 },
        );
      }),
    );

    await expect(refreshSession()).rejects.toThrow();
  });
});
