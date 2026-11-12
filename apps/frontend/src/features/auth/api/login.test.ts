import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { ApiError } from '@/lib/api-error';
import { login } from './login';

const mockValidResponse = {
  accessToken: 'header.payload.signature',
  accessTokenExpiresAt: '2026-10-30T10:15:00.000Z',
  refreshTokenExpiresAt: '2026-11-06T10:00:00.000Z',
  user: {
    id: 'usr-123',
    names: 'Juan',
    firstSurname: 'Pérez',
    secondSurname: 'García',
    email: 'juan.perez@untrm.edu.pe',
  },
};

describe('login API', () => {
  it('posts credentials and parses the response', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('http://localhost:3000/auth/login', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockValidResponse, { status: 200 });
      }),
    );

    const result = await login({
      email: 'JUAN.PEREZ@untrm.edu.pe',
      password: 'StrongPassword123',
    });

    expect(capturedBody).toEqual({
      email: 'juan.perez@untrm.edu.pe',
      password: 'StrongPassword123',
    });
    expect(result).toEqual(mockValidResponse);
  });

  it('rejects a response that breaks the contract', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.json(
          {
            accessToken: 'token-without-dates',
            // Missing accessTokenExpiresAt, refreshToken, user...
          },
          { status: 200 },
        );
      }),
    );

    await expect(
      login({
        email: 'juan.perez@untrm.edu.pe',
        password: 'StrongPassword123',
      }),
    ).rejects.toThrow();
  });

  it('keeps the error code and retry after seconds', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACCOUNT_LOCKED',
              message:
                'Tu cuenta ha sido bloqueada temporalmente debido a múltiples intentos fallidos.',
              retryAfterSeconds: 900,
            },
          },
          { status: 429 },
        );
      }),
    );

    try {
      await login({
        email: 'juan.perez@untrm.edu.pe',
        password: 'WrongPassword',
      });
      expect.unreachable('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('ACCOUNT_LOCKED');
      expect(apiErr.status).toBe(429);
      expect(apiErr.retryAfterSeconds).toBe(900);
    }
  });

  it('validates request credentials before sending', async () => {
    await expect(
      login({
        email: 'invalid-email-format',
        password: 'pass',
      }),
    ).rejects.toThrow();
  });
});
