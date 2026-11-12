import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { PROTECTED_ROLE_CODE, type RoleDto } from '@sigoa/shared';
import { Can } from '@/components/common/can.js';
import { Button, buttonVariants } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';
import { useChangeRoleStatus } from '../hooks/index.js';
import { getRoleErrorMessage } from '../lib/role-error-message.js';

export interface RoleRowActionsProps {
  role: RoleDto;
  onStatusChangeError?: (message: string) => void;
  onStatusChangeSuccess?: (message: string) => void;
}

export function RoleRowActions({
  role,
  onStatusChangeError,
  onStatusChangeSuccess,
}: RoleRowActionsProps) {
  const [isConfirmingDeactivation, setIsConfirmingDeactivation] = React.useState(false);
  const cancelBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const triggerBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const wasConfirmingRef = React.useRef(false);

  const changeStatusMutation = useChangeRoleStatus();
  const isPending = changeStatusMutation.isPending;

  const isProtectedRole = role.code === PROTECTED_ROLE_CODE;

  React.useEffect(() => {
    if (!isConfirmingDeactivation) return;

    cancelBtnRef.current?.focus();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsConfirmingDeactivation(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isConfirmingDeactivation]);

  React.useEffect(() => {
    if (wasConfirmingRef.current && !isConfirmingDeactivation) {
      triggerBtnRef.current?.focus();
    }
    wasConfirmingRef.current = isConfirmingDeactivation;
  }, [isConfirmingDeactivation]);

  const handleDeactivate = () => {
    if (isPending) return;

    changeStatusMutation.mutate(
      {
        id: role.id,
        body: { status: 'INACTIVE', confirmed: true },
      },
      {
        onSuccess: () => {
          setIsConfirmingDeactivation(false);
          onStatusChangeSuccess?.(`Se desactivó el rol '${role.name}' correctamente.`);
        },
        onError: (err) => {
          setIsConfirmingDeactivation(false);
          const msg = getRoleErrorMessage(err);
          onStatusChangeError?.(msg);
        },
      },
    );
  };

  const handleReactivate = () => {
    if (isPending) return;

    changeStatusMutation.mutate(
      {
        id: role.id,
        body: { status: 'ACTIVE' },
      },
      {
        onSuccess: () => {
          onStatusChangeSuccess?.(`Se reactivó el rol '${role.name}' correctamente.`);
        },
        onError: (err) => {
          const msg = getRoleErrorMessage(err);
          onStatusChangeError?.(msg);
        },
      },
    );
  };

  if (isConfirmingDeactivation) {
    const userWarning =
      role.userCount > 0
        ? `Está asignado a ${role.userCount} usuario(s); perderán sus permisos en su siguiente petición, y podrás reactivarlo después.`
        : 'No tiene usuarios asignados.';

    return (
      <Can permission="rol.editar">
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={`deactivate-title-${role.id}`}
          aria-describedby={`deactivate-desc-${role.id}`}
          className="flex flex-col items-end gap-1.5 p-2 rounded-md border border-border bg-card shadow-sm"
        >
          <span id={`deactivate-title-${role.id}`} className="sr-only">
            Confirmar desactivación del rol
          </span>
          <span
            id={`deactivate-desc-${role.id}`}
            className="text-label font-medium text-destructive max-w-xs text-right"
          >
            ¿Desactivar el rol {role.name}? {userWarning}
          </span>
          <div className="flex items-center gap-2 pt-1">
            <Button
              ref={cancelBtnRef}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsConfirmingDeactivation(false);
              }}
              disabled={isPending}
              aria-label={`Cancelar desactivación del rol ${role.name}`}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeactivate}
              disabled={isPending}
              aria-label={`Confirmar desactivación del rol ${role.name}`}
            >
              Confirmar desactivación
            </Button>
          </div>
        </div>
      </Can>
    );
  }

  return (
    <Can permission="rol.editar">
      <div className="flex items-center justify-end gap-1">
        <Link
          to="/roles/$roleId/permisos"
          params={{ roleId: role.id }}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          aria-label={`Permisos del rol ${role.name}`}
        >
          Permisos
        </Link>
        <Link
          to="/roles/$roleId/editar"
          params={{ roleId: role.id }}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          aria-label={`Editar rol ${role.name}`}
        >
          Editar
        </Link>

        {role.status === 'ACTIVE' && !isProtectedRole && (
          <Button
            ref={triggerBtnRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirmingDeactivation(true)}
            disabled={isPending}
            aria-label={`Desactivar rol ${role.name}`}
          >
            Desactivar
          </Button>
        )}

        {role.status === 'INACTIVE' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReactivate}
            disabled={isPending}
            aria-label={`Reactivar rol ${role.name}`}
          >
            Reactivar
          </Button>
        )}
      </div>
    </Can>
  );
}
