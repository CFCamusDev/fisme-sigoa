export interface NavFilterItem {
  readonly href: string;
  readonly permission?: string;
  readonly activeMatch?: readonly string[];
}

export interface NavFilterGroup<TItem extends NavFilterItem = NavFilterItem> {
  readonly id: string;
  readonly items: readonly TItem[];
}

export interface ResolvedNavGroup<
  TGroup extends NavFilterGroup<TItem>,
  TItem extends NavFilterItem = TGroup['items'][number],
> {
  readonly group: TGroup;
  readonly items: readonly TItem[];
  readonly isLoading: boolean;
}

export interface ResolveNavGroupsOptions {
  readonly isLoading: boolean;
  readonly isError?: boolean;
  readonly isAllowed: (permission: string) => boolean;
}

function isPathMatch(pathname: string, prefix: string): boolean {
  if (prefix === '/') {
    return pathname === '/';
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isNavItemActive(pathname: string, item: NavFilterItem): boolean {
  if (isPathMatch(pathname, item.href)) {
    return true;
  }
  if (!item.activeMatch) {
    return false;
  }
  return item.activeMatch.some((prefix) => isPathMatch(pathname, prefix));
}

export function resolveNavGroups<
  TGroup extends NavFilterGroup<TItem>,
  TItem extends NavFilterItem = TGroup['items'][number],
>(
  groups: readonly TGroup[],
  options: ResolveNavGroupsOptions,
): readonly ResolvedNavGroup<TGroup, TItem>[] {
  const { isLoading, isError = false, isAllowed } = options;
  const resolved: ResolvedNavGroup<TGroup, TItem>[] = [];

  for (const group of groups) {
    const hasGatedItems = group.items.some((item) => Boolean(item.permission));

    if (isError) {
      const ungated = group.items.filter((item) => !item.permission);
      if (ungated.length > 0) {
        resolved.push({ group, items: ungated, isLoading: false });
      }
      continue;
    }

    if (isLoading) {
      if (hasGatedItems) {
        const ungated = group.items.filter((item) => !item.permission);
        resolved.push({ group, items: ungated, isLoading: true });
      } else if (group.items.length > 0) {
        resolved.push({ group, items: group.items, isLoading: false });
      }
      continue;
    }

    const permitted = group.items.filter((item) => !item.permission || isAllowed(item.permission));
    if (permitted.length > 0) {
      resolved.push({ group, items: permitted, isLoading: false });
    }
  }

  return resolved;
}
