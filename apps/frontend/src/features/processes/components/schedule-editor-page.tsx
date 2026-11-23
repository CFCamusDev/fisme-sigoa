import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { useChangeScheduleActivityStatus } from '../hooks/use-change-schedule-activity-status';
import { useProposeSchedule } from '../hooks/use-propose-schedule';
import { useSaveSchedule } from '../hooks/use-save-schedule';
import { useSchedule } from '../hooks/use-schedule';
import { getScheduleErrorMessage } from '../lib/schedule-error-message';
import { ExecutionStatusBar } from './execution-status-bar';
import { ScheduleEditor } from './schedule-editor';

export interface ScheduleEditorPageProps {
  readonly executionId: string;
}

export function ScheduleEditorPage({ executionId }: ScheduleEditorPageProps) {
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const query = useSchedule(executionId);
  const proposeMutation = useProposeSchedule(executionId);
  const saveMutation = useSaveSchedule(executionId);
  const statusMutation = useChangeScheduleActivityStatus(executionId);

  const mutationError = proposeMutation.error ?? saveMutation.error ?? statusMutation.error ?? null;
  const errorMessage = mutationError ? getScheduleErrorMessage(mutationError) : null;

  return (
    <section className="space-y-6 bg-background text-foreground">
      <PageHeader
        title="Cronograma de ejecución (Anexo 1)"
        description="Planifica las actividades, responsables, metas, indicadores, fechas y avance de la ejecución."
        actions={
          <Button variant="outline" asChild>
            <Link to="/ejecuciones">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Volver a ejecuciones
            </Link>
          </Button>
        }
      />

      <ExecutionStatusBar executionId={executionId} />

      {query.isPending ? (
        <LoadingState message="Cargando cronograma…" />
      ) : query.isError ? (
        <ErrorState
          title="No se pudo cargar el cronograma"
          message={getScheduleErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ScheduleEditor
          items={query.data?.items ?? []}
          isProposing={proposeMutation.isPending}
          isSaving={saveMutation.isPending}
          isChangingStatus={statusMutation.isPending}
          errorMessage={errorMessage}
          showSavedNotice={showSavedNotice && !errorMessage}
          onPropose={() => {
            setShowSavedNotice(false);
            proposeMutation.mutate();
          }}
          onSave={(payload) => {
            setShowSavedNotice(false);
            saveMutation.mutate(payload, {
              onSuccess: () => setShowSavedNotice(true),
            });
          }}
          onStartActivity={(activityId) =>
            statusMutation.mutate({ activityId, body: { status: 'IN_PROGRESS' } })
          }
          onCompleteActivity={(activityId, actualEndDate) =>
            statusMutation.mutate({
              activityId,
              body: {
                status: 'COMPLETED',
                ...(actualEndDate ? { actualEndDate } : {}),
              },
            })
          }
        />
      )}
    </section>
  );
}
