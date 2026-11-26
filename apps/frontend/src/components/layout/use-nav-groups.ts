import { useQuery } from '@tanstack/react-query';
import { permissionsQueryOptions } from '@/features/authorization';
import { isPermissionGranted } from '@/hooks/use-permission';
import { resolveNavGroups, type ResolvedNavGroup } from '@/lib/nav-filter';
import { selectAuthUser, selectIsAuthenticated, useAuthStore } from '@/stores/auth.store';
import type { NavGroup, NavItem } from './nav-items';

export function useNavGroups(
  groups: readonly NavGroup[],
): readonly ResolvedNavGroup<NavGroup, NavItem>[] {
  const user = useAuthStore(selectAuthUser);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const userId = isAuthenticated && user ? user.id : '';

  const query = useQuery({
    ...permissionsQueryOptions(userId),
    enabled: Boolean(userId),
  });

  const isLoading = Boolean(userId) && query.isPending;
  const isError = Boolean(userId) && !query.isPending && (query.isError || !query.data);

  return resolveNavGroups(groups, {
    isLoading,
    isError,
    isAllowed: (code) => isPermissionGranted(query.data?.permissions, code),
  });
}
