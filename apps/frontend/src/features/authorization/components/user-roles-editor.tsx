import * as React from 'react';
import type { RoleDto, UserAccessRole } from '@sigoa/shared';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { StatusBadge } from '@/components/common/status-badge.js';
import { cn } from '@/lib/utils.js';
import {
  buildUserRolesDraft,
  countUserRoleChanges,
  isUserRoleSaveDisabled,
  toggleRoleInDraft,
} from '../lib/user-roles-draft.js';

export interface UserRolesEditorProps {
  readonly assignedRoles: readonly UserAccessRole[];
  readonly catalogRoles: readonly RoleDto[];
  readonly isSaving?: boolean;
  readonly onSave: (roleIds: string[]) => void;
  readonly onDiscard?: () => void;
  readonly className?: string;
}

export function UserRolesEditor({
  assignedRoles,
  catalogRoles,
  isSaving = false,
  onSave,
  onDiscard,
  className,
}: UserRolesEditorProps) {
  const baseIds = React.useMemo(
    () => buildUserRolesDraft(assignedRoles.map((r) => r.id)),
    [assignedRoles],
  );

  const [prevBaseIds, setPrevBaseIds] = React.useState(baseIds);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(baseIds);

  if (baseIds !== prevBaseIds) {
    setPrevBaseIds(baseIds);
    setSelectedIds(baseIds);
  }

  const displayedRoles = React.useMemo(() => {
    const activeFromCatalog = catalogRoles.filter((r) => r.status === 'ACTIVE');
    const catalogIds = new Set(activeFromCatalog.map((r) => r.id));

    // Incluir roles inactivos asignados que el usuario ya tenga
    const inactiveAssigned: Array<{
      id: string;
      code: string;
      name: string;
      description?: string;
      status: 'INACTIVE';
    }> = assignedRoles
      .filter((ar) => ar.status === 'INACTIVE' && !catalogIds.has(ar.id))
      .map((ar) => ({
        id: ar.id,
        code: ar.code,
        name: ar.name,
        description: 'Rol inactivo asignado previamente.',
        status: 'INACTIVE',
      }));

    return [...activeFromCatalog, ...inactiveAssigned];
  }, [catalogRoles, assignedRoles]);

  const changesCount = React.useMemo(
    () => countUserRoleChanges(baseIds, selectedIds),
    [baseIds, selectedIds],
  );

  const saveDisabled = isSaving || isUserRoleSaveDisabled(selectedIds, baseIds);

  const handleToggle = (roleId: string) => {
    setSelectedIds((prev) => toggleRoleInDraft(prev, roleId));
  };

  const handleDiscard = () => {
    setSelectedIds(baseIds);
    onDiscard?.();
  };

  const handleSave = () => {
    if (saveDisabled) return;
    const sorted = Array.from(selectedIds).sort();
    onSave(sorted);
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        {displayedRoles.map((role) => {
          const isChecked = selectedIds.has(role.id);
          const isInactive = role.status === 'INACTIVE';
          const checkboxDisabled = isSaving || (isInactive && !isChecked);
          const checkboxId = `role-checkbox-${role.id}`;

          return (
            <label
              key={role.id}
              htmlFor={checkboxId}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors',
                isChecked && 'border-primary/40 bg-brand-50/20',
                checkboxDisabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <Checkbox
                id={checkboxId}
                checked={isChecked}
                disabled={checkboxDisabled}
                onChange={() => handleToggle(role.id)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{role.name}</span>
                  {isInactive && <StatusBadge status="INACTIVE" />}
                </div>
                {isInactive ? (
                  <p className="text-xs text-muted-foreground">
                    No concede permisos; puedes quitarlo.
                  </p>
                ) : (
                  role.description && (
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  )
                )}
              </div>
            </label>
          );
        })}
      </div>

      {selectedIds.size === 0 && (
        <p className="text-xs font-medium text-destructive">Selecciona al menos un rol.</p>
      )}

      {selectedIds.size > 10 && (
        <p className="text-xs font-medium text-destructive">
          No se pueden asignar más de 10 roles.
        </p>
      )}

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
          <Button type="button" onClick={handleSave} disabled={saveDisabled} aria-busy={isSaving}>
            {isSaving ? 'Guardando…' : 'Guardar roles'}
          </Button>
        </div>
      </div>
    </div>
  );
}
