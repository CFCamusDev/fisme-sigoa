import * as React from 'react';
import { PROTECTED_ROLE_CODE, type PermissionDto, type RoleDto } from '@sigoa/shared';
import { Button } from '@/components/ui/button.js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
import { Can } from '@/components/common/can.js';
import { useUpdateRolePermissions } from '../hooks/index.js';
import {
  buildDraft,
  countChanges,
  toUpdateRequest,
  type DraftScope,
  type PermissionDraft,
} from '../lib/permission-draft.js';
import { getRoleErrorMessage } from '../lib/role-error-message.js';
import { PermissionScopeTable } from './permission-scope-table.js';

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

      <PermissionScopeTable
        catalog={catalog}
        baseDraft={baseDraft}
        draft={draft}
        disabled={isPending}
        onScopeChange={(code, scope) => {
          setOverrides((prev) => ({
            ...prev,
            [code]: scope,
          }));
        }}
        protectedCodes={isProtectedRole ? ['rol.ver', 'rol.editar'] : undefined}
        protectedHint="El rol Administrador debe conservar este permiso con alcance Global"
        headingLevel="h2"
      />

      <Can permission="rol.editar">
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
      </Can>
    </div>
  );
}
