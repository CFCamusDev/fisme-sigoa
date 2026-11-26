import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { PROTECTED_ROLE_CODE, type RoleDto } from '@sigoa/shared';
import { ConfirmDialog } from '@/components/common';
import { Can } from '@/components/common/can.js';
import { Button, buttonVariants } from '@/components/ui/button.js';
import { useRestoreFocus } from '@/hooks/use-restore-focus.js';
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
  const [confirmAction, setConfirmAction] = React.useState<'inactivate' | 'reactivate' | null>(
    null,
  );
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const { remember, restore } = useRestoreFocus();

  const changeStatusMutation = useChangeRoleStatus();
  const isPending = changeStatusMutation.isPending;

  const isProtectedRole = role.code === PROTECTED_ROLE_CODE;

  const userWarning =
    role.userCount > 0
      ? `Está asignado a ${role.userCount} usuario(s); perderán sus permisos en su siguiente petición, y podrás reactivarlo después.`
      : 'No tiene usuarios asignados.';

  const handleConfirm = () => {
    if (isPending || !confirmAction) return;

    const nextStatus = confirmAction === 'inactivate' ? 'INACTIVE' : 'ACTIVE';

    changeStatusMutation.mutate(
      {
        id: role.id,
        body:
          nextStatus === 'INACTIVE'
            ? { status: 'INACTIVE', confirmed: true }
            : { status: 'ACTIVE' },
      },
      {
        onSuccess: () => {
          const action = confirmAction;
          setConfirmAction(null);
          setDialogError(null);
          onStatusChangeSuccess?.(
            action === 'inactivate'
              ? `Se inactivó el rol '${role.name}' correctamente.`
              : `Se reactivó el rol '${role.name}' correctamente.`,
          );
        },
        onError: (err) => {
          const msg = getRoleErrorMessage(err);
          setDialogError(msg);
          onStatusChangeError?.(msg);
        },
      },
    );
  };

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
            type="button"
            variant="ghost"
            size="sm"
            onClick={(event) => {
              remember(event.currentTarget);
              setDialogError(null);
              setConfirmAction('inactivate');
            }}
            disabled={isPending}
            aria-label={`Inactivar rol ${role.name}`}
          >
            Inactivar
          </Button>
        )}

        {role.status === 'INACTIVE' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(event) => {
              remember(event.currentTarget);
              setDialogError(null);
              setConfirmAction('reactivate');
            }}
            disabled={isPending}
            aria-label={`Reactivar rol ${role.name}`}
          >
            Reactivar
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
            setDialogError(null);
          }
        }}
        title={confirmAction === 'inactivate' ? 'Inactivar rol' : 'Reactivar rol'}
        description={
          confirmAction === 'inactivate'
            ? `¿Inactivar el rol ${role.name}? ${userWarning}`
            : `¿Reactivar el rol ${role.name}?`
        }
        confirmLabel={confirmAction === 'inactivate' ? 'Inactivar' : 'Reactivar'}
        pendingLabel={confirmAction === 'inactivate' ? 'Inactivando…' : 'Reactivando…'}
        tone={confirmAction === 'inactivate' ? 'destructive' : 'default'}
        isPending={isPending}
        error={dialogError}
        onConfirm={handleConfirm}
        onCloseAutoFocus={restore}
      />
    </Can>
  );
}
