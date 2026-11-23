import { useEffect, useId, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ban, Lock } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import {
  VOID_REASON_MAX_LENGTH,
  VOID_REASON_MIN_LENGTH,
  voidProcessExecutionRequestSchema,
  type ProcessExecutionStatusValue,
  type VoidProcessExecutionRequest,
} from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { useCloseProcessExecution } from '../hooks/use-close-process-execution';
import { useVoidProcessExecution } from '../hooks/use-void-process-execution';
import { getTransitionErrorMessage } from '../lib/execution-status-labels';
import { PreconditionIcon, extractConflictDetails } from './execution-precondition-helpers';

export interface ExecutionClosureActionsProps {
  readonly executionId: string;
  readonly status: ProcessExecutionStatusValue;
}

type ActivePanel = 'close' | 'void' | null;

export function ExecutionClosureActions({ executionId, status }: ExecutionClosureActionsProps) {
  const { allowed: canClosePermission } = usePermission('ejecucion.cerrar');
  const { allowed: canVoidPermission } = usePermission('ejecucion.anular');

  const closeMutation = useCloseProcessExecution(executionId);
  const voidMutation = useVoidProcessExecution(executionId);

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const closeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const voidTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  const closeTitleId = useId();
  const closeDescId = useId();
  const voidTitleId = useId();
  const voidReasonId = useId();
  const voidErrorId = useId();

  const canClose = canClosePermission && status === 'PENDING_APPROVAL';
  const canVoid = canVoidPermission && status !== 'CLOSED' && status !== 'VOIDED';
  const isBusy = closeMutation.isPending || voidMutation.isPending;

  const {
    control,
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<VoidProcessExecutionRequest>({
    resolver: zodResolver(voidProcessExecutionRequestSchema),
    defaultValues: { reason: '' },
  });

  const reasonValue = useWatch({ control, name: 'reason', defaultValue: '' });

  useEffect(() => {
    if (activePanel === 'close') {
      cancelCloseBtnRef.current?.focus();
    } else if (activePanel === 'void') {
      setFocus('reason');
    }
  }, [activePanel, setFocus]);

  useEffect(() => {
    if (!activePanel) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isBusy) {
        return;
      }
      const previousPanel = activePanel;
      setActivePanel(null);
      if (previousPanel === 'close') {
        closeTriggerRef.current?.focus();
      } else {
        voidTriggerRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePanel, isBusy]);

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
    setActivePanel('close');
  };

  const handleCancelClose = () => {
    setActivePanel(null);
    closeMutation.reset();
    closeTriggerRef.current?.focus();
  };

  const handleConfirmClose = () => {
    if (isBusy) return;
    closeMutation.mutate(undefined, {
      onSuccess: () => {
        setActivePanel(null);
      },
    });
  };

  const handleOpenVoidPanel = () => {
    closeMutation.reset();
    voidMutation.reset();
    reset({ reason: '' });
    setActivePanel('void');
  };

  const handleCancelVoid = () => {
    setActivePanel(null);
    voidMutation.reset();
    reset({ reason: '' });
    voidTriggerRef.current?.focus();
  };

  const onSubmitVoid = handleSubmit((data) => {
    if (isBusy) return;
    voidMutation.mutate(data, {
      onSuccess: () => {
        setActivePanel(null);
        reset({ reason: '' });
      },
    });
  });

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
            onClick={handleOpenVoidPanel}
          >
            <Ban className="size-4" aria-hidden="true" />
            Anular ejecución
          </Button>
        ) : null}
      </div>

      {activePanel === 'close' ? (
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

      {activePanel === 'void' ? (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={voidTitleId}
          className="space-y-3 rounded-md border border-border bg-card p-3 text-card-foreground"
        >
          <h3 id={voidTitleId} className="text-sm font-semibold text-foreground">
            Anular ejecución
          </h3>

          <form onSubmit={onSubmitVoid} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <label htmlFor={voidReasonId} className="block text-sm font-medium text-foreground">
                Motivo de anulación
              </label>
              <Textarea
                id={voidReasonId}
                rows={3}
                disabled={isBusy}
                aria-invalid={errors.reason ? 'true' : undefined}
                aria-describedby={errors.reason ? voidErrorId : undefined}
                placeholder="Describe por qué se anula esta ejecución…"
                {...register('reason')}
              />
              <p className="text-xs text-muted-foreground">
                {reasonValue.trim().length} / {VOID_REASON_MAX_LENGTH} (mínimo{' '}
                {VOID_REASON_MIN_LENGTH} caracteres)
              </p>
              {errors.reason ? (
                <p id={voidErrorId} role="alert" className="text-sm text-danger">
                  {errors.reason.message}
                </p>
              ) : null}
            </div>

            {voidMutation.error ? (
              <p role="alert" className="text-sm text-danger">
                {getTransitionErrorMessage(voidMutation.error)}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={handleCancelVoid}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" size="sm" disabled={isBusy}>
                {voidMutation.isPending ? 'Anulando…' : 'Confirmar anulación'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
