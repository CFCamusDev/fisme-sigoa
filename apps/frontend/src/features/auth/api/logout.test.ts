import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { logout } from './logout';

describe('logout API (T-002-09, CA2)', () => {
  it('posts without a body and resolves on 204', async () => {
    let called = false;

    server.use(
      http.post('http://localhost:3000/auth/logout', () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(logout()).resolves.toBeUndefined();
    expect(called).toBe(true);
  });

  it('propagates API errors when the server responds with an error status', async () => {
    server.use(
      http.post('http://localhost:3000/auth/logout', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Acceso no autorizado',
            },
          },
          { status: 401 },
        );
      }),
    );

    await expect(logout()).rejects.toThrow();
  });
});
