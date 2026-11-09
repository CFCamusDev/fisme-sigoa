import * as React from 'react';
import type { PermissionDto } from '@sigoa/shared';
import { Select } from '@/components/ui/select.js';
import { cn } from '@/lib/utils.js';
import { groupByModule, type DraftScope, type PermissionDraft } from '../lib/permission-draft.js';

export interface PermissionScopeTableProps {
  readonly catalog: readonly PermissionDto[];
  readonly baseDraft: PermissionDraft;
  readonly draft: PermissionDraft;
  readonly disabled?: boolean;
  readonly onScopeChange: (permissionCode: string, scope: DraftScope) => void;
  readonly protectedCodes?: readonly string[];
  readonly protectedHint?: string;
  readonly headingLevel?: 'h2' | 'h3' | 'h4';
  readonly className?: string;
}

export function PermissionScopeTable({
  catalog,
  baseDraft,
  draft,
  disabled = false,
  onScopeChange,
  protectedCodes,
  protectedHint,
  headingLevel = 'h2',
  className,
}: PermissionScopeTableProps) {
  const groupedModules = React.useMemo(() => groupByModule(catalog), [catalog]);
  const protectedSet = React.useMemo(() => new Set(protectedCodes ?? []), [protectedCodes]);
  const HeadingTag = headingLevel;

  return (
    <div className={cn('space-y-8', className)}>
      {Object.entries(groupedModules).map(([moduleName, permissions]) => {
        const headingId = `module-heading-${moduleName.replace(/\s+/g, '-').toLowerCase()}`;

        return (
          <section key={moduleName} aria-labelledby={headingId} className="space-y-3">
            <HeadingTag id={headingId} className="text-h3 font-semibold text-foreground">
              {moduleName}
            </HeadingTag>

            <div className="surface overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-body border-collapse">
                <caption className="sr-only">
                  Matriz de permisos para el módulo {moduleName}
                </caption>
                <thead className="bg-brand-100 text-brand-700 font-semibold border-b border-border">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Permiso
                    </th>
                    <th scope="col" className="px-4 py-3 w-56">
                      Acceso
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {permissions.map((permission) => {
                    const isModified = draft[permission.code] !== baseDraft[permission.code];
                    const isProtected = protectedSet.has(permission.code);

                    return (
                      <tr
                        key={permission.code}
                        className={cn(
                          'transition-colors duration-150',
                          isModified && 'bg-brand-50',
                        )}
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-label font-medium text-foreground">
                              {permission.code}
                            </span>
                            {isModified && (
                              <span className="inline-flex items-center rounded-sm bg-brand-100 px-1.5 py-0.5 text-caption font-semibold text-brand-700">
                                Modificado
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-label text-muted-foreground">
                            {permission.description}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Select
                            value={draft[permission.code] ?? 'NONE'}
                            disabled={disabled || isProtected}
                            aria-label={`Acceso a ${permission.code}`}
                            aria-describedby={
                              isProtected ? `protected-hint-${permission.code}` : undefined
                            }
                            onChange={(e) => {
                              const newScope = e.target.value as DraftScope;
                              onScopeChange(permission.code, newScope);
                            }}
                          >
                            <option value="NONE">Sin acceso</option>
                            <option value="GLOBAL">Global</option>
                            <option value="OWN">Propio</option>
                          </Select>
                          {isProtected && protectedHint && (
                            <p
                              id={`protected-hint-${permission.code}`}
                              className="mt-1 text-caption text-muted-foreground"
                            >
                              {protectedHint}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
