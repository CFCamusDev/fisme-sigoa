import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { getSessionRefresher } from '@/lib/session-refresh';
import { useAuthStore, selectIsAuthenticated } from '@/stores/auth.store';
import { configureSession } from './session';

describe('session configuration (T-002-10, CA3)', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
    vi.restoreAllMocks();
    testQueryClient = new QueryClient();
  });

  it('clears the session and the query cache and navigates to login with the session-expired reason', async () => {
    useAuthStore.getState().setAuthSession({
      accessToken: 'valid-token',
      accessTokenExpiresAt: new Date(Date.now() + 10000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 50000).toISOString(),
      user: {
        id: 'usr_1',
        names: 'Test',
        firstSurname: 'User',
        secondSurname: null,
        email: 'test@untrm.edu.pe',
      },
    });

    testQueryClient.setQueryData(['sensitive-data'], { payload: 123 });
    const navigateToLogin = vi.fn();

    configureSession({
      navigateToLogin,
      queryClientOverride: testQueryClient,
    });

    // Simular que el endpoint de refresh devuelve 401 (sesión expirada/revocada)
    server.use(
      http.post('http://localhost:3000/auth/refresh', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Sesión no válida',
            },
          },
          { status: 401 },
        );
      }),
    );

    const refresher = getSessionRefresher();
    expect(refresher).not.toBeNull();

    const success = await refresher!.refresh();

    expect(success).toBe(false);
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(testQueryClient.getQueryData(['sensitive-data'])).toBeUndefined();
    expect(navigateToLogin).toHaveBeenCalledWith('session-expired');
  });

  it('removes me/permissions queries when the user session is cleared', () => {
    useAuthStore.getState().setAuthSession({
      accessToken: 'valid-token',
      accessTokenExpiresAt: new Date(Date.now() + 10000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 50000).toISOString(),
      user: {
        id: 'usr_1',
        names: 'Test',
        firstSurname: 'User',
        secondSurname: null,
        email: 'test@untrm.edu.pe',
      },
    });

    testQueryClient.setQueryData(['me', 'permissions', 'usr_1'], {
      permissions: [{ code: 'usuario.ver', scope: 'GLOBAL' }],
    });

    configureSession({
      navigateToLogin: vi.fn(),
      queryClientOverride: testQueryClient,
    });

    useAuthStore.getState().clearAuthSession();

    expect(testQueryClient.getQueryData(['me', 'permissions', 'usr_1'])).toBeUndefined();
  });
});
