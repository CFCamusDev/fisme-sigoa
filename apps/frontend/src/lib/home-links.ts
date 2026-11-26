import type { NavFilterGroup, NavFilterItem, ResolvedNavGroup } from './nav-filter';

export function getHomeQuickLinkGroups<
  TGroup extends NavFilterGroup<TItem>,
  TItem extends NavFilterItem = TGroup['items'][number],
>(
  resolvedGroups: readonly ResolvedNavGroup<TGroup, TItem>[],
): readonly ResolvedNavGroup<TGroup, TItem>[] {
  const result: ResolvedNavGroup<TGroup, TItem>[] = [];

  for (const entry of resolvedGroups) {
    if (entry.isLoading || entry.group.id === 'inicio') {
      continue;
    }
    const items = entry.items.filter((item) => item.href !== '/');
    if (items.length > 0) {
      result.push({
        ...entry,
        items,
      });
    }
  }

  return result;
}
