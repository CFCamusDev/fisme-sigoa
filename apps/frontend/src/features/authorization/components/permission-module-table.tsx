import * as React from 'react';
import type { PermissionDto } from '@sigoa/shared';
import { Select } from '@/components/ui/select.js';
import { cn } from '@/lib/utils.js';
import type { DraftScope, PermissionDraft } from '../lib/permission-draft.js';

export interface PermissionModuleTableProps {
  readonly moduleName: string;
  readonly permissions: readonly PermissionDto[];
  readonly baseDraft: PermissionDraft;
  readonly draft: PermissionDraft;
  readonly disabled?: boolean;
  readonly onScopeChange: (permissionCode: string, scope: DraftScope) => void;
  readonly protectedCodes?: readonly string[];
  readonly protectedHint?: string;
  readonly className?: string;
}

export function PermissionModuleTable({
  moduleName,
  permissions,
  baseDraft,
  draft,
  disabled = false,
  onScopeChange,
  protectedCodes,
  protectedHint,
  className,
}: PermissionModuleTableProps) {
  const protectedSet = React.useMemo(() => new Set(protectedCodes ?? []), [protectedCodes]);

  return (
    <div className={cn('surface overflow-hidden rounded-lg border border-border', className)}>
      <table className="w-full border-collapse text-left text-body">
        <caption className="sr-only">Matriz de permisos para el módulo {moduleName}</caption>
        <thead className="border-b border-border bg-brand-100 font-semibold text-brand-700">
          <tr>
            <th scope="col" className="px-4 py-3">
              Permiso
            </th>
            <th scope="col" className="w-56 px-4 py-3">
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
                className={cn('transition-colors motion-color', isModified && 'bg-brand-50')}
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
                  <p className="mt-1 text-label text-muted-foreground">{permission.description}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <Select
                    value={draft[permission.code] ?? 'NONE'}
                    disabled={disabled || isProtected}
                    aria-label={`Acceso a ${permission.code}`}
                    aria-describedby={isProtected ? `protected-hint-${permission.code}` : undefined}
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
  );
}
