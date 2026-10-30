import { create } from 'zustand';
import type { AuthUser, LoginResponse } from '@sigoa/shared';

export interface AuthSession {
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshToken: string | null;
  refreshTokenExpiresAt: string | null;
  user: AuthUser | null;
}

export interface AuthStoreState extends AuthSession {
  setAuthSession: (session: LoginResponse) => void;
  clearAuthSession: () => void;
}

const initialState: AuthSession = {
  accessToken: null,
  accessTokenExpiresAt: null,
  refreshToken: null,
  refreshTokenExpiresAt: null,
  user: null,
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  ...initialState,
  setAuthSession: (session: LoginResponse) =>
    set({
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
      user: session.user,
    }),
  clearAuthSession: () => set(initialState),
}));

export const selectIsAuthenticated = (state: AuthStoreState): boolean => {
  if (!state.accessToken || !state.refreshTokenExpiresAt) {
    return false;
  }
  const expiresAt = new Date(state.refreshTokenExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

export const selectAuthUser = (state: AuthStoreState): AuthUser | null => state.user;
export const selectAccessToken = (state: AuthStoreState): string | null => state.accessToken;
