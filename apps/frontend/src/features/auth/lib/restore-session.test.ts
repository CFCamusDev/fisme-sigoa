import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth.store';
import { clearSessionHint, hasValidSessionHint, setSessionHint } from './session-hint';
import { restoreSession } from './restore-session';

const mockRefreshPayload = {
  accessToken: 'restored-jwt-token',
  accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
  refreshTokenExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  user: {
    id: 'usr_restored',
    names: 'María',
    firstSurname: 'Gonzales',
    secondSurname: 'Ríos',
    email: 'maria.gonzales@untrm.edu.pe',
  },
};

describe('restoreSession (T-002-10, CA1)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
    clearSessionHint();
  });

  it('skips the network request when there is no valid session hint', async () => {
    let networkCalled = false;
    server.use(
      http.post('http://localhost:3000/auth/refresh', () => {
        networkCalled = true;
        return HttpResponse.json(mockRefreshPayload);
      }),
    );

    const restored = await restoreSession();

    expect(restored).toBe(false);
    expect(networkCalled).toBe(false);
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
  });

  it('calls the refresh endpoint, populates the store and keeps the hint on success', async () => {
    setSessionHint(new Date(Date.now() + 60_000).toISOString());

    server.use(
      http.post('http://localhost:3000/auth/refresh', () => {
        return HttpResponse.json(mockRefreshPayload, { status: 200 });
      }),
    );

    const restored = await restoreSession();

    expect(restored).toBe(true);
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('restored-jwt-token');
    expect(useAuthStore.getState().user?.email).toBe('maria.gonzales@untrm.edu.pe');
    expect(hasValidSessionHint()).toBe(true);
  });

  it('clears the hint and session when the refresh returns 401', async () => {
    setSessionHint(new Date(Date.now() + 60_000).toISOString());

    server.use(
      http.post('http://localhost:3000/auth/refresh', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Token de refresco inválido o revocado',
            },
          },
          { status: 401 },
        );
      }),
    );

    const restored = await restoreSession();

    expect(restored).toBe(false);
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
    expect(hasValidSessionHint()).toBe(false);
  });

  it('preserves the hint when a network failure occurs so reload can retry', async () => {
    setSessionHint(new Date(Date.now() + 60_000).toISOString());

    server.use(
      http.post('http://localhost:3000/auth/refresh', () => {
        return HttpResponse.error();
      }),
    );

    const restored = await restoreSession();

    expect(restored).toBe(false);
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
    expect(hasValidSessionHint()).toBe(true);
  });

  it('deduplicates concurrent restoreSession calls into a single network request (CA1)', async () => {
    setSessionHint(new Date(Date.now() + 60_000).toISOString());

    let callCount = 0;
    server.use(
      http.post('http://localhost:3000/auth/refresh', async () => {
        callCount++;
        // Simular latencia de red para forzar coincidencia concurrente
        await new Promise((resolve) => setTimeout(resolve, 30));
        return HttpResponse.json(mockRefreshPayload, { status: 200 });
      }),
    );

    const [firstResult, secondResult] = await Promise.all([restoreSession(), restoreSession()]);

    expect(callCount).toBe(1);
    expect(firstResult).toBe(true);
    expect(secondResult).toBe(true);
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);
  });
});
