import type {
  EffectiveAccessEntry,
  EffectiveAccessSource,
  ListPermissionsResponse,
  PermissionScope,
} from '@sigoa/shared';

export interface FormattedEffectiveAccessEntry extends EffectiveAccessEntry {
  readonly description: string;
  readonly scopeLabel: string;
  readonly sourceLabels: readonly string[];
}

export interface EffectiveAccessModuleGroup {
  readonly module: string;
  readonly entries: readonly FormattedEffectiveAccessEntry[];
}

export function describeScope(scope: PermissionScope): string {
  return scope === 'GLOBAL' ? 'Global' : 'Propio';
}

export function describeSource(source: EffectiveAccessSource): string {
  const scopeLabel = describeScope(source.scope);
  if (source.kind === 'ROLE') {
    return `Rol ${source.roleName} · ${scopeLabel}`;
  }
  return `Directo · ${scopeLabel}`;
}

export function groupEntriesByModule(
  entries: readonly EffectiveAccessEntry[],
  catalog?: ListPermissionsResponse,
): readonly EffectiveAccessModuleGroup[] {
  if (entries.length === 0) {
    return [];
  }

  const catalogMap = new Map<string, { module: string; description: string }>();
  if (catalog?.items) {
    for (const item of catalog.items) {
      catalogMap.set(item.code, {
        module: item.module,
        description: item.description,
      });
    }
  }

  const groups = new Map<string, FormattedEffectiveAccessEntry[]>();

  for (const entry of entries) {
    const meta = catalogMap.get(entry.permissionCode);
    const moduleName = meta?.module || 'Sin módulo';
    const description = meta?.description || '';

    const formatted: FormattedEffectiveAccessEntry = {
      ...entry,
      description,
      scopeLabel: describeScope(entry.scope),
      sourceLabels: entry.sources.map(describeSource),
    };

    const existing = groups.get(moduleName);
    if (existing) {
      existing.push(formatted);
    } else {
      groups.set(moduleName, [formatted]);
    }
  }

  const result: EffectiveAccessModuleGroup[] = [];

  const sortedModules = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'Sin módulo') return 1;
    if (b === 'Sin módulo') return -1;
    return a.localeCompare(b, 'es');
  });

  for (const mod of sortedModules) {
    const moduleEntries = groups.get(mod) ?? [];
    moduleEntries.sort((a, b) => a.permissionCode.localeCompare(b.permissionCode, 'es'));
    result.push({
      module: mod,
      entries: moduleEntries,
    });
  }

  return result;
}
