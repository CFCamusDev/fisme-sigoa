export function buildUserRolesDraft(assignedRoleIds: readonly string[]): Set<string> {
  return new Set(assignedRoleIds);
}

export function toggleRoleInDraft(current: ReadonlySet<string>, roleId: string): Set<string> {
  const next = new Set(current);
  if (next.has(roleId)) {
    next.delete(roleId);
  } else {
    next.add(roleId);
  }
  return next;
}

export function areUserRoleDraftsEqual(
  base: ReadonlySet<string>,
  current: ReadonlySet<string>,
): boolean {
  if (base.size !== current.size) {
    return false;
  }
  for (const id of base) {
    if (!current.has(id)) {
      return false;
    }
  }
  return true;
}

export function countUserRoleChanges(
  base: ReadonlySet<string>,
  current: ReadonlySet<string>,
): number {
  let changes = 0;
  // Roles que estaban en base pero ya no están en current (removidos)
  for (const id of base) {
    if (!current.has(id)) {
      changes += 1;
    }
  }
  // Roles que están en current pero no estaban en base (añadidos)
  for (const id of current) {
    if (!base.has(id)) {
      changes += 1;
    }
  }
  return changes;
}

export function isUserRoleSaveDisabled(
  current: ReadonlySet<string>,
  base: ReadonlySet<string>,
): boolean {
  if (current.size === 0 || current.size > 10) {
    return true;
  }
  return areUserRoleDraftsEqual(base, current);
}
