import { EmptyState } from '@/components/common/empty-state';
import type { EffectiveAccessEntry, ListPermissionsResponse } from '@sigoa/shared';
import { groupEntriesByModule } from '../lib/effective-access-view';

export interface EffectivePermissionsViewProps {
  readonly entries: readonly EffectiveAccessEntry[];
  readonly catalog?: ListPermissionsResponse;
  readonly headingLevel?: 'h3' | 'h4';
  readonly className?: string;
}

export function EffectivePermissionsView({
  entries,
  catalog,
  headingLevel = 'h3',
  className,
}: EffectivePermissionsViewProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Este usuario no tiene permisos efectivos"
        description="Asigna roles o permisos directos para otorgar acceso a los módulos del sistema."
        className={className}
      />
    );
  }

  const moduleGroups = groupEntriesByModule(entries, catalog);
  const HeadingTag = headingLevel;

  return (
    <div className={className}>
      <div className="space-y-6">
        {moduleGroups.map((group) => (
          <div key={group.module} className="rounded-lg border border-border bg-card p-4">
            <HeadingTag className="mb-3 text-base font-semibold text-foreground">
              {group.module}
            </HeadingTag>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-brand-50/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-3 py-2">
                      Permiso
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Alcance
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Origen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {group.entries.map((entry) => (
                    <tr key={entry.permissionCode} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {entry.permissionCode}
                        </div>
                        {entry.description && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {entry.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block text-xs font-medium text-foreground">
                          {entry.scopeLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {entry.sourceLabels.map((label, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
