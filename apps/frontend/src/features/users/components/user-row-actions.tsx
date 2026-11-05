import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import type { UserDto } from '@sigoa/shared';
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
  const [isConfirmingDeactivation, setIsConfirmingDeactivation] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);

  const currentUser = useAuthStore((state) => state.user);
  const isSelf = currentUser?.id === user.id;

  const changeStatusMutation = useChangeUserStatus();
  const isPending = changeStatusMutation.isPending;

  const fullName = [user.names, user.firstSurname].filter(Boolean).join(' ');

  useEffect(() => {
    if (isConfirmingDeactivation) {
      cancelBtnRef.current?.focus();

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsConfirmingDeactivation(false);
          triggerBtnRef.current?.focus();
        }
      };

      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown);
      };
    }
  }, [isConfirmingDeactivation]);

  const handleDeactivate = () => {
    if (isPending) return;
    changeStatusMutation.mutate(
      { id: user.id, body: { status: 'INACTIVE' } },
      {
        onSuccess: () => {
          setIsConfirmingDeactivation(false);
          onStatusChangeSuccess?.(`Se inactivó la cuenta de ${fullName} correctamente.`);
        },
        onError: (err) => {
          setIsConfirmingDeactivation(false);
          const msg = getUserErrorMessage(err);
          onStatusChangeError?.(msg);
        },
      },
    );
  };

  const handleReactivate = () => {
    if (isPending) return;
    changeStatusMutation.mutate(
      { id: user.id, body: { status: 'ACTIVE' } },
      {
        onSuccess: () => {
          onStatusChangeSuccess?.(`Se reactivó la cuenta de ${fullName} correctamente.`);
        },
        onError: (err) => {
          const msg = getUserErrorMessage(err);
          onStatusChangeError?.(msg);
        },
      },
    );
  };

  if (isConfirmingDeactivation) {
    return (
      <div
        role="alertdialog"
        aria-modal="false"
        aria-labelledby={`deactivate-title-${user.id}`}
        aria-describedby={`deactivate-desc-${user.id}`}
        className="flex flex-col items-end gap-1.5"
      >
        <span id={`deactivate-title-${user.id}`} className="sr-only">
          Confirmar inactivación de usuario
        </span>
        <span id={`deactivate-desc-${user.id}`} className="text-label font-medium text-destructive">
          ¿Inactivar a {fullName}? Se cerrarán sus sesiones activas.
        </span>
        <div className="flex items-center gap-2">
          <Button
            ref={cancelBtnRef}
            variant="outline"
            size="sm"
            onClick={() => {
              setIsConfirmingDeactivation(false);
              triggerBtnRef.current?.focus();
            }}
            disabled={isPending}
            aria-label={`Cancelar inactivación de ${fullName}`}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeactivate}
            disabled={isPending}
            aria-label={`Confirmar inactivación de ${fullName}`}
          >
            Confirmar inactivación
          </Button>
        </div>
      </div>
    );
  }

  return (
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
          ref={triggerBtnRef}
          variant="outline"
          size="sm"
          onClick={() => setIsConfirmingDeactivation(true)}
          disabled={isPending}
          aria-label={`Inactivar a ${fullName}`}
        >
          Inactivar
        </Button>
      )}

      {user.status === 'INACTIVE' && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleReactivate}
          disabled={isPending}
          aria-label={`Reactivar a ${fullName}`}
        >
          Reactivar
        </Button>
      )}
    </div>
  );
}
