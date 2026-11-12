import { redirect } from '@tanstack/react-router';
import type { PermissionScope } from '@sigoa/shared';
import { permissionsQueryOptions } from '@/features/authorization';
import { isPermissionGranted } from '@/hooks/use-permission';
import { queryClient } from '@/lib/query-client';
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth.store';

export class ForbiddenRouteError extends Error {
  public readonly permission: string;
  public readonly scope: PermissionScope;

  constructor(permission: string, scope: PermissionScope = 'GLOBAL') {
    super(`No tienes permiso para acceder a esta ruta (${permission} [${scope}]).`);
    this.name = 'ForbiddenRouteError';
    this.permission = permission;
    this.scope = scope;
  }
}

export async function guardPermission(
  permission: string,
  scope: PermissionScope = 'GLOBAL',
): Promise<void> {
  const authState = useAuthStore.getState();
  if (!selectIsAuthenticated(authState) || !authState.user) {
    throw redirect({ to: '/login' });
  }

  const data = await queryClient.ensureQueryData(permissionsQueryOptions(authState.user.id));

  if (!isPermissionGranted(data.permissions, permission, scope)) {
    throw new ForbiddenRouteError(permission, scope);
  }
}
