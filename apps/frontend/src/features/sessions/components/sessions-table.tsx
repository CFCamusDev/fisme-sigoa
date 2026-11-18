import type { SessionDto } from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { STAKEHOLDER_LIST_TYPE_LABELS } from '@/features/stakeholders';
import { SESSION_MODALITY_LABELS, formatSessionDate } from '../lib/session-labels';

export interface SessionsTableProps {
  readonly items: readonly SessionDto[];
  readonly executionNamesById: ReadonlyMap<string, string>;
  readonly onEdit: (session: SessionDto) => void;
  readonly onManageAttendees?: (session: SessionDto) => void;
}

export function SessionsTable({
  items,
  executionNamesById,
  onEdit,
  onManageAttendees,
}: SessionsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card text-card-foreground">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="border-b border-border bg-muted text-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Fecha
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Hora
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Constituyente
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Modalidad
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Enlaces
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Ejecuciones
            </th>
            <Can permission="sesion.editar">
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Acciones
              </th>
            </Can>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((session) => (
            <tr key={session.id} className="hover:bg-muted/40">
              <td className="px-4 py-3 whitespace-nowrap">
                {formatSessionDate(session.sessionDate)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{session.startTime}</td>
              <td className="px-4 py-3">{STAKEHOLDER_LIST_TYPE_LABELS[session.stakeholderType]}</td>
              <td className="px-4 py-3">{SESSION_MODALITY_LABELS[session.modality]}</td>
              <td className="px-4 py-3">
                {!session.meetingUrl && !session.recordingUrl ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-col gap-1">
                    {session.meetingUrl && (
                      <a
                        href={session.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        Reunión
                      </a>
                    )}
                    {session.recordingUrl && (
                      <a
                        href={session.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        Grabación
                      </a>
                    )}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <ul className="space-y-0.5">
                  {session.executionIds.map((execId) => (
                    <li key={execId}>{executionNamesById.get(execId) ?? execId}</li>
                  ))}
                </ul>
              </td>
              <Can permission="sesion.editar">
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {onManageAttendees && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onManageAttendees(session)}
                      >
                        Asistentes
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(session)}
                    >
                      Editar
                    </Button>
                  </div>
                </td>
              </Can>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
