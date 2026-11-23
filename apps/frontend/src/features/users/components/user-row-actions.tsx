import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { UserDto } from '@sigoa/shared';
import { ConfirmDialog } from '@/components/common';
import { Can } from '@/components/common/can';
import { Button, buttonVariants } from '@/components/ui/button';
import { useRestoreFocus } from '@/hooks/use-restore-focus';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useChangeUserStatus } from '../hooks/use-change-user-status';
import { getUserErrorMessage } from '../lib/user-error-message';

export interface UserRowActionsProps {
  user: UserDto;
  onStatusChangeError?: (message: string) => void;
  onStatusChangeSuccess?: (message: string) => void;
}

export function UserRowActions({
  user,
  onStatusChangeError,
  onStatusChangeSuccess,
}: UserRowActionsProps) {
  const [confirmAction, setConfirmAction] = useState<'inactivate' | 'reactivate' | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const { remember, restore } = useRestoreFocus();

  const currentUser = useAuthStore((state) => state.user);
  const isSelf = currentUser?.id === user.id;

  const changeStatusMutation = useChangeUserStatus();
  const isPending = changeStatusMutation.isPending;

  const fullName = [user.names, user.firstSurname].filter(Boolean).join(' ');

  const handleConfirm = () => {
    if (isPending || !confirmAction) return;
    const nextStatus = confirmAction === 'inactivate' ? 'INACTIVE' : 'ACTIVE';

    changeStatusMutation.mutate(
      { id: user.id, body: { status: nextStatus } },
      {
        onSuccess: () => {
          const action = confirmAction;
          setConfirmAction(null);
          setDialogError(null);
          onStatusChangeSuccess?.(
            action === 'inactivate'
              ? `Se inactivó la cuenta de ${fullName} correctamente.`
              : `Se reactivó la cuenta de ${fullName} correctamente.`,
          );
        },
        onError: (err) => {
          const msg = getUserErrorMessage(err);
          setDialogError(msg);
          onStatusChangeError?.(msg);
        },
      },
    );
  };

  return (
    <Can permission="usuario.editar">
      <div className="flex items-center justify-end gap-2">
        <Link
          to="/usuarios/$userId/editar"
          params={{ userId: user.id }}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          aria-label={`Editar a ${fullName}`}
        >
          Editar
        </Link>

        {user.status === 'ACTIVE' && !isSelf && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              remember(event.currentTarget);
              setDialogError(null);
              setConfirmAction('inactivate');
            }}
            disabled={isPending}
            aria-label={`Inactivar a ${fullName}`}
          >
            Inactivar
          </Button>
        )}

        {user.status === 'INACTIVE' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              remember(event.currentTarget);
              setDialogError(null);
              setConfirmAction('reactivate');
            }}
            disabled={isPending}
            aria-label={`Reactivar a ${fullName}`}
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
        title={confirmAction === 'inactivate' ? 'Inactivar usuario' : 'Reactivar usuario'}
        description={
          confirmAction === 'inactivate'
            ? `¿Inactivar a ${fullName}? Se cerrarán sus sesiones activas.`
            : `¿Reactivar la cuenta de ${fullName}? Podrá volver a iniciar sesión.`
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
