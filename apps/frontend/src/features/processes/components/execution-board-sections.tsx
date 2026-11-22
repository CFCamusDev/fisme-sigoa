import type {
  ExecutionBoardPendingItem,
  ExecutionBoardSchedule,
  ExecutionBoardSessions,
  ExecutionBoardUnavailableSection,
} from '@sigoa/shared';
import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Users,
} from 'lucide-react';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import {
  BOARD_PENDING_LINK_LABELS,
  BOARD_PENDING_STATE_LABELS,
  BOARD_SESSION_MODALITY_LABELS,
  BOARD_STAKEHOLDER_TYPE_LABELS,
  formatBoardDate,
} from '../lib/execution-board-labels';

export interface ScheduleSectionProps {
  readonly executionId: string;
  readonly schedule: ExecutionBoardSchedule;
}

export function BoardScheduleSection({ executionId, schedule }: ScheduleSectionProps) {
  return (
    <section
      aria-labelledby="board-schedule-heading"
      className="rounded-lg border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" aria-hidden="true" />
          <h2 id="board-schedule-heading" className="text-base font-semibold text-foreground">
            Cronograma
          </h2>
        </div>
        <Can permission="cronograma.ver">
          <Button variant="outline" size="sm" asChild>
            <Link to="/cronograma/$executionId" params={{ executionId }}>
              Ver cronograma
            </Link>
          </Button>
        </Can>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Avance general</span>
          <span className="font-semibold text-foreground">{schedule.progressPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Avance del cronograma"
          aria-valuenow={schedule.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${schedule.progressPercent}%` }}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div className="rounded-md border border-border bg-background p-2.5">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="mt-0.5 font-semibold text-foreground">{schedule.total}</dd>
        </div>
        <div className="rounded-md border border-border bg-background p-2.5">
          <dt className="text-xs text-muted-foreground">Completadas</dt>
          <dd className="mt-0.5 font-semibold text-success">{schedule.completed}</dd>
        </div>
        <div className="rounded-md border border-border bg-background p-2.5">
          <dt className="text-xs text-muted-foreground">En curso</dt>
          <dd className="mt-0.5 font-semibold text-foreground">{schedule.inProgress}</dd>
        </div>
        <div className="rounded-md border border-border bg-background p-2.5">
          <dt className="text-xs text-muted-foreground">Pendientes</dt>
          <dd className="mt-0.5 font-semibold text-foreground">{schedule.pending}</dd>
        </div>
        <div className="rounded-md border border-border bg-background p-2.5">
          <dt className="text-xs text-muted-foreground">Vencidas</dt>
          <dd className="mt-0.5 font-semibold text-danger">{schedule.overdue}</dd>
        </div>
      </dl>
    </section>
  );
}

export interface SessionsSectionProps {
  readonly sessions: ExecutionBoardSessions;
}

export function BoardSessionsSection({ sessions }: SessionsSectionProps) {
  return (
    <section
      aria-labelledby="board-sessions-heading"
      className="rounded-lg border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" aria-hidden="true" />
          <h2 id="board-sessions-heading" className="text-base font-semibold text-foreground">
            Sesiones
          </h2>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/sesiones">Ir a sesiones</Link>
        </Button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Total registradas: <span className="font-semibold text-foreground">{sessions.total}</span>
        {sessions.lastSessionDate
          ? ` · Última sesión: ${formatBoardDate(sessions.lastSessionDate)}`
          : ' · Sin sesiones registradas aún'}
      </p>

      {sessions.items.length > 0 ? (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-background">
          {sessions.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="font-medium text-foreground">
                {BOARD_STAKEHOLDER_TYPE_LABELS[item.stakeholderType]}
              </span>
              <span className="text-muted-foreground">
                {formatBoardDate(item.sessionDate)} · {item.startTime} ·{' '}
                {BOARD_SESSION_MODALITY_LABELS[item.modality]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export interface UnavailableSectionCardProps {
  readonly id: string;
  readonly title: string;
  readonly reason: string;
  readonly data: ExecutionBoardUnavailableSection;
}

export function BoardUnavailableSectionCard({ id, title, reason }: UnavailableSectionCardProps) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-lg border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          Aún no disponible
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
    </section>
  );
}

export interface PendingSectionProps {
  readonly executionId: string;
  readonly pending: readonly ExecutionBoardPendingItem[];
}

function renderPendingTargetLink(executionId: string, item: ExecutionBoardPendingItem) {
  const label = BOARD_PENDING_LINK_LABELS[item.target];

  if (item.target === 'SCHEDULE') {
    return (
      <Button variant="link" size="sm" className="h-auto p-0" asChild>
        <Link to="/cronograma/$executionId" params={{ executionId }}>
          {label}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </Button>
    );
  }

  if (item.target === 'SESSIONS' || item.target === 'SURVEYS' || item.target === 'MINUTES') {
    return (
      <Button variant="link" size="sm" className="h-auto p-0" asChild>
        <Link to="/sesiones">
          {label}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </Button>
    );
  }

  return <span className="text-xs text-muted-foreground">{label}</span>;
}

export function BoardPendingSection({ executionId, pending }: PendingSectionProps) {
  return (
    <section
      aria-labelledby="board-pending-heading"
      className="rounded-lg border border-border bg-card p-5 text-card-foreground"
    >
      <h2 id="board-pending-heading" className="text-base font-semibold text-foreground">
        Pendientes
      </h2>

      {pending.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-3 text-sm text-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
          <span>No hay pendientes: la ejecución cumple todo lo requerido</span>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-background">
          {pending.map((item) => {
            const isUnmet = item.state === 'UNMET';
            const StateIcon = isUnmet ? AlertCircle : HelpCircle;
            const stateTone = isUnmet ? 'text-danger' : 'text-warning';

            return (
              <li
                key={item.code}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="flex items-start gap-2">
                  <StateIcon className={`mt-0.5 size-4 shrink-0 ${stateTone}`} aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className={`text-xs font-medium ${stateTone}`}>
                      {BOARD_PENDING_STATE_LABELS[item.state]}
                    </p>
                  </div>
                </div>
                {renderPendingTargetLink(executionId, item)}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
