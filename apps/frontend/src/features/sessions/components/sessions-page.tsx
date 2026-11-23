import { useId, useMemo, useState } from 'react';
import type { SessionAttendeesResponse, SessionDto } from '@sigoa/shared';
import { AlertTriangle, Plus } from 'lucide-react';
import { PageHeader } from '@/components/common';
import { Can } from '@/components/common/can';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useProcessExecutions } from '@/features/processes';
import { useExecutionSessions } from '../hooks/use-execution-sessions';
import { getSessionErrorMessage } from '../lib/session-error-message';
import { SessionAttendeesPanel } from './session-attendees-panel';
import { SessionForm } from './session-form';
import { SessionsTable } from './sessions-table';

type PanelState =
  | { readonly mode: 'closed' }
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly session: SessionDto }
  | { readonly mode: 'attendees'; readonly session: SessionDto };

const PAGE_SIZE = 20;

export function SessionsPage() {
  const executionSelectId = useId();
  const [selectedExecutionId, setSelectedExecutionId] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [panelState, setPanelState] = useState<PanelState>({ mode: 'closed' });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const executionsQuery = useProcessExecutions({ page: 1, pageSize: 100 });
  const executions = useMemo(
    () => executionsQuery.data?.items ?? [],
    [executionsQuery.data?.items],
  );

  const activeExecutionId = useMemo(() => {
    if (selectedExecutionId && executions.some((item) => item.id === selectedExecutionId)) {
      return selectedExecutionId;
    }
    return executions[0]?.id ?? '';
  }, [executions, selectedExecutionId]);

  const executionNamesById = useMemo(
    () => new Map(executions.map((item) => [item.id, item.name])),
    [executions],
  );

  const executionStatusesById = useMemo(
    () => new Map(executions.map((item) => [item.id, item.status])),
    [executions],
  );

  const sessionsQuery = useExecutionSessions(activeExecutionId || undefined, {
    page,
    pageSize: PAGE_SIZE,
  });

  const total = sessionsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleExecutionChange(nextId: string) {
    setSelectedExecutionId(nextId);
    setPage(1);
    setPanelState({ mode: 'closed' });
  }

  function handleSaved(saved: SessionDto) {
    const wasEditing = panelState.mode === 'edit';
    setPanelState({ mode: 'closed' });
    setStatusMessage(
      wasEditing
        ? 'Los cambios de la sesión se guardaron correctamente.'
        : 'La sesión se registró correctamente.',
    );
    if (saved.executionIds.length > 0 && !saved.executionIds.includes(activeExecutionId)) {
      setSelectedExecutionId(saved.executionIds[0] ?? '');
      setPage(1);
    }
  }

  function handleAttendeesSaved(response: SessionAttendeesResponse) {
    setPanelState({ mode: 'closed' });
    setStatusMessage(
      response.attendeeCount === 1
        ? 'Se registró 1 asistente en la sesión.'
        : `Se registraron ${response.attendeeCount} asistentes en la sesión.`,
    );
  }

  return (
    <div className="space-y-6 bg-background text-foreground">
      <PageHeader
        title="Sesiones"
        description="Registra y consulta reuniones con constituyentes vinculadas a las ejecuciones de proceso."
        actions={
          <Can permission="sesion.editar">
            <Button
              type="button"
              disabled={!activeExecutionId}
              onClick={() => {
                setStatusMessage(null);
                setPanelState({ mode: 'create' });
              }}
            >
              <Plus className="mr-2 size-4" />
              Nueva sesión
            </Button>
          </Can>
        }
      />

      {statusMessage && (
        <div
          role="status"
          className="rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground"
        >
          {statusMessage}
        </div>
      )}

      {executionsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando ejecuciones…</p>
      ) : executionsQuery.isError ? (
        <Alert variant="danger">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{getSessionErrorMessage(executionsQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void executionsQuery.refetch()}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : executions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-card-foreground">
          <p className="text-sm text-muted-foreground">
            No existen ejecuciones de proceso registradas. Crea una ejecución primero en{' '}
            <a href="/ejecuciones" className="text-primary underline underline-offset-2">
              Ejecuciones
            </a>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="max-w-md space-y-1.5">
            <Label htmlFor={executionSelectId}>Ejecución</Label>
            <Select
              id={executionSelectId}
              value={activeExecutionId}
              onChange={(event) => handleExecutionChange(event.target.value)}
            >
              {executions.map((execution) => (
                <option key={execution.id} value={execution.id}>
                  {execution.name}
                </option>
              ))}
            </Select>
          </div>

          {panelState.mode === 'create' && (
            <SessionForm onSaved={handleSaved} onCancel={() => setPanelState({ mode: 'closed' })} />
          )}

          {panelState.mode === 'edit' && (
            <SessionForm
              session={panelState.session}
              onSaved={handleSaved}
              onCancel={() => setPanelState({ mode: 'closed' })}
            />
          )}

          {sessionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando sesiones…</p>
          ) : sessionsQuery.isError ? (
            <Alert variant="danger">
              <AlertTriangle className="size-4" />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{getSessionErrorMessage(sessionsQuery.error)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void sessionsQuery.refetch()}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : (sessionsQuery.data?.items.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-card-foreground">
              <p className="text-sm text-muted-foreground">Esta ejecución aún no tiene sesiones.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <SessionsTable
                items={sessionsQuery.data?.items ?? []}
                executionNamesById={executionNamesById}
                executionStatusesById={executionStatusesById}
                onEdit={(session) => {
                  setStatusMessage(null);
                  setPanelState({ mode: 'edit', session });
                }}
                onManageAttendees={(session) => {
                  setStatusMessage(null);
                  setPanelState({ mode: 'attendees', session });
                }}
              />

              {panelState.mode === 'attendees' && (
                <SessionAttendeesPanel
                  key={panelState.session.id}
                  session={panelState.session}
                  onSaved={handleAttendeesSaved}
                  onCancel={() => setPanelState({ mode: 'closed' })}
                />
              )}

              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Página {page} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
