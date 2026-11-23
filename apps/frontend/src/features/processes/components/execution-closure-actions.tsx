import { useEffect, useId, useRef, useState } from 'react';
import { Ban, Lock } from 'lucide-react';
import {
  VOID_REASON_MAX_LENGTH,
  VOID_REASON_MIN_LENGTH,
  type ProcessExecutionStatusValue,
} from '@sigoa/shared';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import { useCloseProcessExecution } from '../hooks/use-close-process-execution';
import { useVoidProcessExecution } from '../hooks/use-void-process-execution';
import { getTransitionErrorMessage } from '../lib/execution-status-labels';
import { PreconditionIcon, extractConflictDetails } from './execution-precondition-helpers';

export interface ExecutionClosureActionsProps {
  readonly executionId: string;
  readonly status: ProcessExecutionStatusValue;
}

export function ExecutionClosureActions({ executionId, status }: ExecutionClosureActionsProps) {
  const { allowed: canClosePermission } = usePermission('ejecucion.cerrar');
  const { allowed: canVoidPermission } = usePermission('ejecucion.anular');

  const closeMutation = useCloseProcessExecution(executionId);
  const voidMutation = useVoidProcessExecution(executionId);

  const [closePanelOpen, setClosePanelOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  const closeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const voidTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  const closeTitleId = useId();
  const closeDescId = useId();

  const canClose = canClosePermission && status === 'PENDING_APPROVAL';
  const canVoid = canVoidPermission && status !== 'CLOSED' && status !== 'VOIDED';
  const isBusy = closeMutation.isPending || voidMutation.isPending;

  useEffect(() => {
    if (closePanelOpen) {
      cancelCloseBtnRef.current?.focus();
    }
  }, [closePanelOpen]);

  useEffect(() => {
    if (!closePanelOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isBusy) {
        return;
      }
      setClosePanelOpen(false);
      closeTriggerRef.current?.focus();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePanelOpen, isBusy]);

  if (!canClose && !canVoid) {
    return null;
  }

  const closeConflictDetails =
    closeMutation.error?.status === 409
      ? extractConflictDetails(closeMutation.error.details)
      : undefined;

  const handleOpenClosePanel = () => {
    closeMutation.reset();
    voidMutation.reset();
    setClosePanelOpen(true);
  };

  const handleCancelClose = () => {
    setClosePanelOpen(false);
    closeMutation.reset();
    closeTriggerRef.current?.focus();
  };

  const handleConfirmClose = () => {
    if (isBusy) return;
    closeMutation.mutate(undefined, {
      onSuccess: () => {
        setClosePanelOpen(false);
      },
    });
  };

  const handleOpenVoidDialog = () => {
    closeMutation.reset();
    voidMutation.reset();
    setClosePanelOpen(false);
    setVoidDialogOpen(true);
  };

  const handleConfirmVoid = (reason?: string) => {
    if (isBusy || !reason) return;
    voidMutation.mutate(
      { reason },
      {
        onSuccess: () => {
          setVoidDialogOpen(false);
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canClose ? (
          <Button
            ref={closeTriggerRef}
            type="button"
            variant="default"
            disabled={isBusy}
            onClick={handleOpenClosePanel}
          >
            <Lock className="size-4" aria-hidden="true" />
            Cerrar ejecución
          </Button>
        ) : null}

        {canVoid ? (
          <Button
            ref={voidTriggerRef}
            type="button"
            variant="destructive"
            disabled={isBusy}
            onClick={handleOpenVoidDialog}
          >
            <Ban className="size-4" aria-hidden="true" />
            Anular ejecución
          </Button>
        ) : null}
      </div>

      {closePanelOpen ? (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={closeTitleId}
          aria-describedby={closeDescId}
          className="space-y-3 rounded-md border border-border bg-card p-3 text-card-foreground"
        >
          <div className="space-y-1">
            <h3 id={closeTitleId} className="text-sm font-semibold text-foreground">
              Confirmar cierre de ejecución
            </h3>
            <p id={closeDescId} className="text-sm text-muted-foreground">
              Al cerrar la ejecución, su contenido quedará congelado de forma permanente y no podrá
              editarse.
            </p>
          </div>

          {closeConflictDetails && closeConflictDetails.length > 0 ? (
            <ul className="space-y-1" aria-label="Precondiciones incumplidas para el cierre">
              {closeConflictDetails.map((detail, index) => (
                <li
                  key={detail.path ?? `close-detail-${index}`}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground"
                >
                  <PreconditionIcon
                    state={detail.message.includes('(no verificable)') ? 'NOT_VERIFIABLE' : 'UNMET'}
                  />
                  <span>{detail.message}</span>
                </li>
              ))}
            </ul>
          ) : closeMutation.error ? (
            <p role="alert" className="text-sm text-danger">
              {getTransitionErrorMessage(closeMutation.error)}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              ref={cancelCloseBtnRef}
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={handleCancelClose}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isBusy}
              onClick={handleConfirmClose}
            >
              {closeMutation.isPending ? 'Cerrando…' : 'Confirmar cierre'}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={voidDialogOpen}
        onOpenChange={(open) => {
          setVoidDialogOpen(open);
          if (!open) {
            voidMutation.reset();
          }
        }}
        title="Anular ejecución"
        description="Al anular la ejecución, quedará inactiva de forma permanente y se registrará el motivo en la auditoría."
        confirmLabel="Confirmar anulación"
        pendingLabel="Anulando…"
        tone="destructive"
        isPending={voidMutation.isPending}
        error={voidMutation.error ? getTransitionErrorMessage(voidMutation.error) : null}
        reason={{
          label: 'Motivo de anulación',
          minLength: VOID_REASON_MIN_LENGTH,
          maxLength: VOID_REASON_MAX_LENGTH,
          placeholder: 'Describe por qué se anula esta ejecución…',
        }}
        onConfirm={handleConfirmVoid}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          voidTriggerRef.current?.focus();
        }}
      />
    </div>
  );
}
