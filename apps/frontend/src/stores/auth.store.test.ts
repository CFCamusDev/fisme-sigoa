import { beforeEach, describe, expect, it } from 'vitest';
import type { LoginResponse } from '@sigoa/shared';
import { useAuthStore, selectIsAuthenticated } from './auth.store';
import { getAuthTokenProvider, setAuthTokenProvider } from '@/lib/axios';

const mockSession: LoginResponse = {
  accessToken: 'jwt-access-token-xyz',
  accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  refreshToken: 'refresh-token-uuid-12345678901234567890',
  refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  user: {
    id: 'usr-123',
    names: 'Ana',
    firstSurname: 'Torres',
    secondSurname: 'Mendoza',
    email: 'ana.torres@untrm.edu.pe',
  },
};

describe('auth.store', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores the session after login in memory', () => {
    useAuthStore.getState().setAuthSession(mockSession);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(mockSession.accessToken);
    expect(state.accessTokenExpiresAt).toBe(mockSession.accessTokenExpiresAt);
    expect(state.refreshToken).toBe(mockSession.refreshToken);
    expect(state.refreshTokenExpiresAt).toBe(mockSession.refreshTokenExpiresAt);
    expect(state.user).toEqual(mockSession.user);
    expect(selectIsAuthenticated(state)).toBe(true);
  });

  it('clears every token on clear', () => {
    useAuthStore.getState().setAuthSession(mockSession);
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);

    useAuthStore.getState().clearAuthSession();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.accessTokenExpiresAt).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.refreshTokenExpiresAt).toBeNull();
    expect(state.user).toBeNull();
    expect(selectIsAuthenticated(state)).toBe(false);
  });

  it('treats an expired refresh token as unauthenticated', () => {
    const expiredSession: LoginResponse = {
      ...mockSession,
      refreshTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
    };

    useAuthStore.getState().setAuthSession(expiredSession);
    const state = useAuthStore.getState();

    expect(selectIsAuthenticated(state)).toBe(false);
  });

  it('does not write tokens or user data to local or session storage (anti-XSS)', () => {
    useAuthStore.getState().setAuthSession(mockSession);

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem('auth-storage')).toBeNull();
    expect(sessionStorage.getItem('auth-storage')).toBeNull();
  });

  it('provides accessToken to axios token provider', () => {
    setAuthTokenProvider(() => useAuthStore.getState().accessToken);

    const provider = getAuthTokenProvider();
    expect(provider).not.toBeNull();
    expect(provider?.()).toBeNull();

    useAuthStore.getState().setAuthSession(mockSession);
    expect(provider?.()).toBe(mockSession.accessToken);

    useAuthStore.getState().clearAuthSession();
    expect(provider?.()).toBeNull();
  });
});
