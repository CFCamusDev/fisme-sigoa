import * as React from 'react';
import { PROTECTED_ROLE_CODE, type PermissionDto, type RoleDto } from '@sigoa/shared';
import { Button } from '@/components/ui/button.js';
import { Select } from '@/components/ui/select.js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
import { cn } from '@/lib/utils.js';
import { useUpdateRolePermissions } from '../hooks/index.js';
import {
  buildDraft,
  countChanges,
  groupByModule,
  toUpdateRequest,
  type DraftScope,
  type PermissionDraft,
} from '../lib/permission-draft.js';
import { getRoleErrorMessage } from '../lib/role-error-message.js';

export interface PermissionMatrixEditorProps {
  role: RoleDto;
  catalog: readonly PermissionDto[];
  onSaveSuccess?: (updatedRole: RoleDto) => void;
  onDiscard?: () => void;
}

export function PermissionMatrixEditor({
  role,
  catalog,
  onSaveSuccess,
  onDiscard,
}: PermissionMatrixEditorProps) {
  const updateMutation = useUpdateRolePermissions();

  const baseDraft = React.useMemo(() => buildDraft(role, catalog), [role, catalog]);
  const [overrides, setOverrides] = React.useState<Record<string, DraftScope>>({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const draft: PermissionDraft = React.useMemo(
    () => ({ ...baseDraft, ...overrides }),
    [baseDraft, overrides],
  );

  const changesCount = React.useMemo(() => countChanges(baseDraft, draft), [baseDraft, draft]);
  const groupedModules = React.useMemo(() => groupByModule(catalog), [catalog]);
  const isProtectedRole = role.code === PROTECTED_ROLE_CODE;

  const isPending = updateMutation.isPending;

  const handleSave = () => {
    if (isPending || changesCount === 0) return;
    setGeneralError(null);
    setSuccessMessage(null);

    const body = toUpdateRequest(draft);
    updateMutation.mutate(
      {
        id: role.id,
        body,
      },
      {
        onSuccess: (updatedRole) => {
          setOverrides({});
          setSuccessMessage('Los permisos se guardaron exitosamente.');
          onSaveSuccess?.(updatedRole);
        },
        onError: (err) => {
          setGeneralError(getRoleErrorMessage(err));
        },
      },
    );
  };

  const handleDiscard = () => {
    setOverrides({});
    setGeneralError(null);
    setSuccessMessage(null);
    onDiscard?.();
  };

  return (
    <div className="space-y-8">
      {successMessage && (
        <Alert variant="success" role="status">
          <AlertTitle>Éxito</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {generalError && (
        <Alert variant="danger" role="alert">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-8">
        {Object.entries(groupedModules).map(([moduleName, permissions]) => (
          <section
            key={moduleName}
            aria-labelledby={`module-heading-${moduleName.replace(/\s+/g, '-').toLowerCase()}`}
            className="space-y-3"
          >
            <h2
              id={`module-heading-${moduleName.replace(/\s+/g, '-').toLowerCase()}`}
              className="text-h3 font-semibold text-foreground"
            >
              {moduleName}
            </h2>

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
                    const isProtected =
                      isProtectedRole &&
                      (permission.code === 'rol.ver' || permission.code === 'rol.editar');

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
                            disabled={isPending || isProtected}
                            aria-label={`Acceso a ${permission.code}`}
                            aria-describedby={
                              isProtected ? `protected-hint-${permission.code}` : undefined
                            }
                            onChange={(e) => {
                              const newScope = e.target.value as DraftScope;
                              setOverrides((prev) => ({
                                ...prev,
                                [permission.code]: newScope,
                              }));
                            }}
                          >
                            <option value="NONE">Sin acceso</option>
                            <option value="GLOBAL">Global</option>
                            <option value="OWN">Propio</option>
                          </Select>
                          {isProtected && (
                            <p
                              id={`protected-hint-${permission.code}`}
                              className="mt-1 text-caption text-muted-foreground"
                            >
                              El rol Administrador debe conservar este permiso con alcance Global
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
        ))}
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-md">
        <div aria-live="polite" className="text-label font-medium text-foreground">
          {changesCount === 1 ? '1 cambio sin guardar' : `${changesCount} cambios sin guardar`}
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={isPending || changesCount === 0}
          >
            Descartar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || changesCount === 0}
            aria-busy={isPending}
          >
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
}
