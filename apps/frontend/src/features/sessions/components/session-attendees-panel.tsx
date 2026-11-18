import { useMemo, useState } from 'react';
import type {
  SessionAttendeeRosterItem,
  SessionAttendeesResponse,
  SessionDto,
} from '@sigoa/shared';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRegisterSessionAttendees } from '../hooks/use-register-session-attendees';
import { useSessionAttendees } from '../hooks/use-session-attendees';
import { getSessionErrorMessage } from '../lib/session-error-message';
import { formatSessionDate } from '../lib/session-labels';
import { SessionAttendeesField } from './session-attendees-field';

export interface SessionAttendeesPanelProps {
  readonly session: SessionDto;
  readonly onSaved: (response: SessionAttendeesResponse) => void;
  readonly onCancel: () => void;
}

function buildInitialSelectedMap(items: readonly SessionAttendeeRosterItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    if (item.attended) {
      map.set(item.listMemberId, item.position ?? '');
    }
  }
  return map;
}

export function SessionAttendeesPanel({ session, onSaved, onCancel }: SessionAttendeesPanelProps) {
  const attendeesQuery = useSessionAttendees(session.id);
  const registerMutation = useRegisterSessionAttendees();
  const [draft, setDraft] = useState<Map<string, string> | null>(null);

  const selected = useMemo(() => {
    if (draft !== null) {
      return draft;
    }
    if (!attendeesQuery.data) {
      return new Map<string, string>();
    }
    return buildInitialSelectedMap(attendeesQuery.data.items);
  }, [attendeesQuery.data, draft]);

  function handleToggle(member: SessionAttendeeRosterItem, checked: boolean) {
    const next = new Map(selected);
    if (checked) {
      next.set(member.listMemberId, member.position ?? member.memberPosition ?? '');
    } else {
      next.delete(member.listMemberId);
    }
    setDraft(next);
  }

  function handlePositionChange(listMemberId: string, position: string) {
    if (!selected.has(listMemberId)) {
      return;
    }
    const next = new Map(selected);
    next.set(listMemberId, position);
    setDraft(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await registerMutation.mutateAsync({
        sessionId: session.id,
        data: {
          attendees: Array.from(selected.entries()).map(([listMemberId, position]) => ({
            listMemberId,
            position: position.trim() || null,
          })),
        },
      });
      onSaved(response);
    } catch {
      // El error queda en registerMutation.error para mostrarlo en la alerta.
    }
  }

  const hasNoList = !session.stakeholderListId || attendeesQuery.data?.stakeholderListId === null;
  const rosterItems = attendeesQuery.data?.items ?? [];

  return (
    <section
      aria-label="Asistentes de la sesión"
      className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Asistentes de la sesión · {formatSessionDate(session.sessionDate)} ({session.startTime})
          </h2>
          <p className="text-sm text-muted-foreground">
            Marca quiénes asistieron de la lista del Anexo 3 y registra su cargo en la sesión.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cerrar
        </Button>
      </div>

      {attendeesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando asistentes…</p>
      ) : attendeesQuery.isError ? (
        <Alert variant="danger">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{getSessionErrorMessage(attendeesQuery.error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void attendeesQuery.refetch()}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : hasNoList ? (
        <p className="text-sm text-muted-foreground">
          Esta sesión no tiene lista del Anexo 3. Asigna una lista a la sesión para registrar
          asistentes.
        </p>
      ) : rosterItems.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">La lista no tiene miembros.</p>
          <p className="text-sm text-muted-foreground">
            ¿La persona no aparece? Agrégala primero a la lista del Anexo 3 en{' '}
            <a href="/listas-constituyentes" className="text-primary underline underline-offset-2">
              Listas de constituyentes
            </a>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          {registerMutation.isError && (
            <Alert variant="danger">
              <AlertTriangle className="size-4" />
              <AlertDescription>{getSessionErrorMessage(registerMutation.error)}</AlertDescription>
            </Alert>
          )}

          <SessionAttendeesField
            items={rosterItems}
            selected={selected}
            disabled={registerMutation.isPending}
            onToggle={handleToggle}
            onPositionChange={handlePositionChange}
          />

          <p className="text-sm text-muted-foreground">
            ¿La persona no aparece? Agrégala primero a la lista del Anexo 3 en{' '}
            <a href="/listas-constituyentes" className="text-primary underline underline-offset-2">
              Listas de constituyentes
            </a>
            .
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={registerMutation.isPending}
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? 'Guardando…' : 'Guardar asistentes'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
