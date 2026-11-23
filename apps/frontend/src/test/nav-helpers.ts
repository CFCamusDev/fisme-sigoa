import { NAV_GROUPS } from '@/components/layout/nav-items';
import { NAV_OPEN_GROUPS_STORAGE_KEY } from '@/components/layout/sidebar';

export function openAllNavGroups(): void {
  window.localStorage.setItem(
    NAV_OPEN_GROUPS_STORAGE_KEY,
    JSON.stringify(NAV_GROUPS.map((group) => group.id)),
  );
}
