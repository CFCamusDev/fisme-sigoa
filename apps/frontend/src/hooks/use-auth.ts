import { useAuthStore, selectIsAuthenticated, selectAuthUser } from '@/stores/auth.store';
import type { AuthUser, LoginResponse } from '@sigoa/shared';

export interface UseAuthResult {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuthSession: (session: LoginResponse) => void;
  clearAuthSession: () => void;
}

export function useAuth(): UseAuthResult {
  const user = useAuthStore(selectAuthUser);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const setAuthSession = useAuthStore((state) => state.setAuthSession);
  const clearAuthSession = useAuthStore((state) => state.clearAuthSession);

  return {
    user,
    isAuthenticated,
    setAuthSession,
    clearAuthSession,
  };
}
