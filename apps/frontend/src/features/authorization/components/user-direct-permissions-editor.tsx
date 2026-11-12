import * as React from 'react';
import type { PermissionDto, RoleGrant } from '@sigoa/shared';
import { Button } from '@/components/ui/button.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Can } from '@/components/common/can.js';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import {
  buildDraft,
  countChanges,
  toUpdateRequest,
  type DraftScope,
  type PermissionDraft,
} from '../lib/permission-draft.js';
import { PermissionScopeTable } from './permission-scope-table.js';

export interface UserDirectPermissionsEditorProps {
  readonly directPermissions: readonly RoleGrant[];
  readonly catalog: readonly PermissionDto[];
  readonly isSaving?: boolean;
  readonly onSave: (permissions: RoleGrant[]) => void;
  readonly onDiscard?: () => void;
  readonly className?: string;
}

export function UserDirectPermissionsEditor({
  directPermissions,
  catalog,
  isSaving = false,
  onSave,
  onDiscard,
  className,
}: UserDirectPermissionsEditorProps) {
  const baseDraft = React.useMemo(
    () => buildDraft({ permissions: [...directPermissions] }, catalog),
    [directPermissions, catalog],
  );

  const [prevBaseDraft, setPrevBaseDraft] = React.useState<PermissionDraft>(baseDraft);
  const [overrides, setOverrides] = React.useState<Record<string, DraftScope>>({});

  if (baseDraft !== prevBaseDraft) {
    setPrevBaseDraft(baseDraft);
    setOverrides({});
  }

  const draft: PermissionDraft = React.useMemo(
    () => ({ ...baseDraft, ...overrides }),
    [baseDraft, overrides],
  );

  const changesCount = React.useMemo(() => countChanges(baseDraft, draft), [baseDraft, draft]);

  const handleScopeChange = (permissionCode: string, scope: DraftScope) => {
    setOverrides((prev) => ({
      ...prev,
      [permissionCode]: scope,
    }));
  };

  const handleDiscard = () => {
    setOverrides({});
    onDiscard?.();
  };

  const handleSave = () => {
    if (isSaving || changesCount === 0) return;
    const body = toUpdateRequest(draft);
    onSave(body.permissions);
  };

  return (
    <div className={cn('space-y-6', className)}>
      <Alert variant="default" className="border-border bg-card">
        <Info className="size-4 text-muted-foreground" aria-hidden="true" />
        <AlertDescription className="text-xs text-muted-foreground">
          Los permisos del rol se muestran en la vista de permisos efectivos. Aquí asignas
          únicamente permisos específicos y directos para este usuario.
        </AlertDescription>
      </Alert>

      <PermissionScopeTable
        catalog={catalog}
        baseDraft={baseDraft}
        draft={draft}
        disabled={isSaving}
        onScopeChange={handleScopeChange}
        headingLevel="h4"
      />

      <Can permission="permiso.asignar">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div aria-live="polite" className="text-xs font-medium text-foreground">
            {changesCount === 1 ? '1 cambio sin guardar' : `${changesCount} cambios sin guardar`}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscard}
              disabled={isSaving || changesCount === 0}
            >
              Descartar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || changesCount === 0}
              aria-busy={isSaving}
            >
              {isSaving ? 'Guardando…' : 'Guardar permisos directos'}
            </Button>
          </div>
        </div>
      </Can>
    </div>
  );
}
