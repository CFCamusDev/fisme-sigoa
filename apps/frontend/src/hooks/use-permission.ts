import { useQuery } from '@tanstack/react-query';
import type { MyPermissionGrant, PermissionScope } from '@sigoa/shared';
import { selectAuthUser, selectIsAuthenticated, useAuthStore } from '@/stores/auth.store';
import { permissionsQueryOptions } from '@/features/authorization';

export interface UsePermissionResult {
  allowed: boolean;
  isLoading: boolean;
}

export function isPermissionGranted(
  permissions: readonly MyPermissionGrant[] | undefined,
  code: string,
  requiredScope: PermissionScope = 'GLOBAL',
): boolean {
  if (!permissions || permissions.length === 0) {
    return false;
  }

  const found = permissions.find((grant) => grant.code === code);
  if (!found) {
    return false;
  }

  if (requiredScope === 'OWN') {
    return found.scope === 'OWN' || found.scope === 'GLOBAL';
  }

  return found.scope === 'GLOBAL';
}

export function usePermission(
  code: string,
  scope: PermissionScope = 'GLOBAL',
): UsePermissionResult {
  const user = useAuthStore(selectAuthUser);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const userId = isAuthenticated && user ? user.id : '';

  const query = useQuery({
    ...permissionsQueryOptions(userId),
    enabled: Boolean(userId),
  });

  if (!userId) {
    return {
      allowed: false,
      isLoading: false,
    };
  }

  if (query.isPending) {
    return {
      allowed: false,
      isLoading: true,
    };
  }

  if (query.isError || !query.data) {
    return {
      allowed: false,
      isLoading: false,
    };
  }

  return {
    allowed: isPermissionGranted(query.data.permissions, code, scope),
    isLoading: false,
  };
}
