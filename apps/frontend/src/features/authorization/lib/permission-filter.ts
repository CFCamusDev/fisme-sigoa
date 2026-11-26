import type { PermissionDto } from '@sigoa/shared';
import type { PermissionDraft } from './permission-draft.js';

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterPermissions(
  catalog: readonly PermissionDto[],
  query: string,
): PermissionDto[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [...catalog];
  }

  return catalog.filter((permission) => {
    const code = normalizeSearchText(permission.code);
    const description = normalizeSearchText(permission.description);
    return code.includes(normalizedQuery) || description.includes(normalizedQuery);
  });
}

export function countAssigned(
  draft: PermissionDraft,
  permissions: readonly PermissionDto[],
): number {
  let count = 0;
  for (const permission of permissions) {
    if ((draft[permission.code] ?? 'NONE') !== 'NONE') {
      count += 1;
    }
  }
  return count;
}
