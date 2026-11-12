import type { ReactNode } from 'react';
import type { PermissionScope } from '@sigoa/shared';
import { usePermission } from '@/hooks/use-permission';

export interface CanProps {
  permission: string;
  scope?: PermissionScope;
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ permission, scope = 'GLOBAL', fallback = null, children }: CanProps) {
  const { allowed, isLoading } = usePermission(permission, scope);

  if (isLoading) {
    return null;
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
