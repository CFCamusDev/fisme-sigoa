import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { useAuthStore } from '@/stores/auth.store';
import * as refreshApi from '../api/refresh';
import { createSessionRefresher } from './session-refresher';

describe('session-refresher (T-002-10, CA1, CA3)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
    vi.restoreAllMocks();
  });

  const mockRenewedSession = {
    accessToken: 'renewed.jwt.token',
    accessTokenExpiresAt: '2026-10-30T10:30:00.000Z',
    refreshTokenExpiresAt: '2026-11-06T10:15:00.000Z',
    user: {
      id: 'usr_renewed_123',
      names: 'Carlos',
      firstSurname: 'Pérez',
      secondSurname: null,
      email: 'carlos.perez@untrm.edu.pe',
    },
  };

  it('stores the renewed session and returns true on success', async () => {
    vi.spyOn(refreshApi, 'refreshSession').mockResolvedValue(mockRenewedSession);
    const onSessionExpired = vi.fn();

    const refresher = createSessionRefresher({ onSessionExpired });
    const success = await refresher.refresh();

    expect(success).toBe(true);
    expect(onSessionExpired).not.toHaveBeenCalled();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(mockRenewedSession.accessToken);
    expect(state.user).toEqual(mockRenewedSession.user);
  });

  it('expires the session on a 401 from refresh and returns false', async () => {
    const error401 = new ApiError({
      code: 'UNAUTHORIZED',
      message: 'La sesión expiró o ya no es válida.',
      status: 401,
    });
    vi.spyOn(refreshApi, 'refreshSession').mockRejectedValue(error401);
    const onSessionExpired = vi.fn();

    const refresher = createSessionRefresher({ onSessionExpired });
    const success = await refresher.refresh();

    expect(success).toBe(false);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('rethrows transient errors without expiring the session', async () => {
    const networkError = new ApiError({
      code: 'NETWORK_ERROR',
      message: 'No se pudo conectar con el servidor.',
      status: 0,
    });
    vi.spyOn(refreshApi, 'refreshSession').mockRejectedValue(networkError);
    const onSessionExpired = vi.fn();

    const refresher = createSessionRefresher({ onSessionExpired });

    await expect(refresher.refresh()).rejects.toBe(networkError);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});
