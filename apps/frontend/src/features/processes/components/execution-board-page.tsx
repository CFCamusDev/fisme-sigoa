import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useExecutionBoard } from '../hooks/use-execution-board';
import { getExecutionBoardErrorMessage } from '../lib/execution-board-labels';
import { PROCESS_TYPE_LABELS } from '../lib/process-type-labels';
import {
  BoardPendingSection,
  BoardScheduleSection,
  BoardSessionsSection,
  BoardUnavailableSectionCard,
} from './execution-board-sections';
import { ExecutionClosureActions } from './execution-closure-actions';

export interface ExecutionBoardPageProps {
  readonly executionId: string;
}

export function ExecutionBoardPage({ executionId }: ExecutionBoardPageProps) {
  const query = useExecutionBoard(executionId);

  return (
    <section className="space-y-6 bg-background text-foreground">
      <PageHeader
        title={query.data ? query.data.execution.name : 'Tablero de ejecución'}
        description={
          query.data
            ? `${PROCESS_TYPE_LABELS[query.data.execution.type]} · ${query.data.execution.semesterCode ?? query.data.execution.year} · Catálogo v${query.data.execution.catalogVersionNumber}`
            : 'Resumen de estado, cronograma, sesiones y pendientes de la ejecución.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {query.data ? <StatusBadge status={query.data.execution.status} /> : null}
            {query.data ? (
              <ExecutionClosureActions
                executionId={executionId}
                status={query.data.execution.status}
              />
            ) : null}
            <Button variant="outline" asChild>
              <Link to="/ejecuciones">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Volver a ejecuciones
              </Link>
            </Button>
          </div>
        }
      />

      {query.data?.execution.status === 'VOIDED' ? (
        <Alert variant="danger">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <StatusBadge status="VOIDED" />
            <span>
              {query.data.execution.voidReason
                ? `Motivo de anulación: ${query.data.execution.voidReason}`
                : 'Esta ejecución ha sido anulada.'}
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {query.isPending ? (
        <LoadingState message="Cargando tablero de la ejecución…" />
      ) : query.isError ? (
        <ErrorState
          title="No se pudo cargar el tablero"
          message={getExecutionBoardErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="space-y-6">
          <BoardPendingSection executionId={executionId} pending={query.data.pending} />

          <div className="grid gap-6 lg:grid-cols-2">
            <BoardScheduleSection executionId={executionId} schedule={query.data.schedule} />
            <BoardSessionsSection sessions={query.data.sessions} />
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <BoardUnavailableSectionCard
              id="board-surveys-heading"
              title="Encuestas"
              reason="Disponible cuando se implemente el módulo de encuestas de constituyentes."
              data={query.data.surveys}
            />
            <BoardUnavailableSectionCard
              id="board-minutes-heading"
              title="Actas"
              reason="Disponible cuando se implemente el módulo de actas y firmas."
              data={query.data.minutes}
            />
            <BoardUnavailableSectionCard
              id="board-results-heading"
              title="Resultados"
              reason="Disponible cuando se implemente el módulo de resultados y logros."
              data={query.data.results}
            />
          </div>
        </div>
      )}
    </section>
  );
}
