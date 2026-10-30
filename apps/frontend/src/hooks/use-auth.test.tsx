import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LoginResponse } from '@sigoa/shared';
import { useAuthStore } from '@/stores/auth.store';
import { useAuth } from './use-auth';

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

describe('useAuth hook', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  it('exposes unauthenticated initial state', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('updates user and authentication flag when setAuthSession is called', () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.setAuthSession(mockSession);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockSession.user);
  });

  it('clears session when clearAuthSession is called', () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.setAuthSession(mockSession);
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.clearAuthSession();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
