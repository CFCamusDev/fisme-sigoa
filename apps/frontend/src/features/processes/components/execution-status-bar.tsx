import { ArrowRight, Check, CircleAlert, CircleCheck, CircleX, RefreshCw } from 'lucide-react';
import type { ExecutionPreconditionResultDto } from '@sigoa/shared';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';
import { useAdvanceProcessExecution } from '../hooks/use-advance-process-execution';
import { useNextTransition } from '../hooks/use-next-transition';
import {
  EXECUTION_FLOW_STEPS,
  PRECONDITION_STATE_LABELS,
  getExecutionStatusLabel,
  getTransitionErrorMessage,
} from '../lib/execution-status-labels';

export interface ExecutionStatusBarProps {
  readonly executionId: string;
}

interface ConflictDetail {
  readonly path?: string;
  readonly message: string;
}

function extractConflictDetails(details: unknown): readonly ConflictDetail[] | undefined {
  if (!Array.isArray(details)) {
    return undefined;
  }
  const parsed: ConflictDetail[] = [];
  for (const item of details) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { message?: unknown }).message === 'string'
    ) {
      const rawPath = (item as { path?: unknown }).path;
      parsed.push({
        ...(typeof rawPath === 'string' ? { path: rawPath } : {}),
        message: (item as { message: string }).message,
      });
    }
  }
  return parsed.length > 0 ? parsed : undefined;
}

function resolveDisplayedPreconditions(
  queryPreconditions: readonly ExecutionPreconditionResultDto[],
  conflictDetails: readonly ConflictDetail[] | undefined,
): readonly {
  readonly code: string;
  readonly label: string;
  readonly state: 'MET' | 'UNMET' | 'NOT_VERIFIABLE';
}[] {
  if (conflictDetails && conflictDetails.length > 0) {
    return conflictDetails.map((detail, index) => ({
      code: detail.path ?? `precondition-${index}`,
      label: detail.message,
      state: detail.message.includes('(no verificable)') ? 'NOT_VERIFIABLE' : 'UNMET',
    }));
  }
  return queryPreconditions;
}

function PreconditionIcon({ state }: { readonly state: 'MET' | 'UNMET' | 'NOT_VERIFIABLE' }) {
  if (state === 'MET') {
    return <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />;
  }
  if (state === 'NOT_VERIFIABLE') {
    return <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />;
  }
  return <CircleX className="size-4 shrink-0 text-danger" aria-hidden="true" />;
}

export function ExecutionStatusBar({ executionId }: ExecutionStatusBarProps) {
  const { allowed: canView } = usePermission('ejecucion.ver');
  const { allowed: canAdvancePermission } = usePermission('ejecucion.avanzar');

  const query = useNextTransition(canView ? executionId : '');
  const advanceMutation = useAdvanceProcessExecution(executionId);

  if (!canView) {
    return null;
  }

  if (query.isPending) {
    return (
      <section
        aria-label="Estado de la ejecución"
        aria-busy="true"
        className="rounded-lg border border-border bg-card p-4 text-card-foreground"
      >
        <p className="text-sm text-muted-foreground">Cargando estado de la ejecución…</p>
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section
        aria-label="Estado de la ejecución"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
      >
        <p className="text-sm text-danger">
          {query.error
            ? getTransitionErrorMessage(query.error)
            : 'No se pudo cargar el estado de la ejecución.'}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Reintentar
        </Button>
      </section>
    );
  }

  const { status, nextStatus, preconditions, canAdvance } = query.data;
  const currentStepIndex = EXECUTION_FLOW_STEPS.indexOf(
    status as (typeof EXECUTION_FLOW_STEPS)[number],
  );
  const conflictDetails =
    advanceMutation.error?.status === 409
      ? extractConflictDetails(advanceMutation.error.details)
      : undefined;
  const displayedPreconditions = resolveDisplayedPreconditions(preconditions, conflictDetails);
  const hasNonDetailError =
    advanceMutation.error && (!conflictDetails || conflictDetails.length === 0);

  return (
    <section
      aria-label="Estado de la ejecución"
      className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Estado actual:</span>
          <StatusBadge status={status} />
        </div>

        {canAdvancePermission && nextStatus !== null ? (
          <Button
            type="button"
            disabled={advanceMutation.isPending || !canAdvance}
            onClick={() => advanceMutation.mutate()}
          >
            <span>
              {advanceMutation.isPending
                ? 'Avanzando…'
                : `Avanzar a ${getExecutionStatusLabel(nextStatus)}`}
            </span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <nav aria-label="Progreso de estados de la ejecución">
        <ol className="flex flex-wrap items-center gap-2">
          {EXECUTION_FLOW_STEPS.map((step, index) => {
            const isCurrent = step === status;
            const isCompleted = currentStepIndex > index;
            return (
              <li
                key={step}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
                  isCurrent
                    ? 'border-primary bg-muted text-foreground'
                    : isCompleted
                      ? 'border-border bg-muted text-foreground'
                      : 'border-border bg-card text-muted-foreground',
                )}
              >
                {isCompleted ? (
                  <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                ) : null}
                <span>{getExecutionStatusLabel(step)}</span>
              </li>
            );
          })}
        </ol>
      </nav>

      <div aria-live="polite" className="space-y-2">
        {hasNonDetailError ? (
          <p role="alert" className="text-sm text-danger">
            {getTransitionErrorMessage(advanceMutation.error)}
          </p>
        ) : null}

        {nextStatus === null ? (
          <p className="text-sm text-muted-foreground">
            Esta ejecución no tiene transiciones de avance pendientes.
          </p>
        ) : (
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold text-foreground">
              Precondiciones para {getExecutionStatusLabel(nextStatus)}
            </h2>
            <ul className="space-y-1">
              {displayedPreconditions.map((item) => (
                <li
                  key={item.code}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <PreconditionIcon state={item.state} />
                    <span>{item.label}</span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {PRECONDITION_STATE_LABELS[item.state]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
