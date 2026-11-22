import type {
  ExecutionBoardPendingStateValue,
  ExecutionBoardPendingTargetValue,
  SessionModalityValue,
  StakeholderListTypeValue,
} from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const esPeDateFormatter = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatBoardDate(isoDate: string): string {
  const match = DATE_PATTERN.exec(isoDate);
  if (!match?.[1] || !match[2] || !match[3]) {
    return isoDate;
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  return esPeDateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

export const BOARD_SESSION_MODALITY_LABELS: Record<SessionModalityValue, string> = {
  VIRTUAL: 'Virtual',
  IN_PERSON: 'Presencial',
  HYBRID: 'Híbrida',
};

export const BOARD_STAKEHOLDER_TYPE_LABELS: Record<StakeholderListTypeValue, string> = {
  ADVISORY_BOARD: 'Comité Consultivo',
  EMPLOYER: 'Empleadores',
  GRADUATE: 'Graduados',
  TEACHER: 'Docentes',
  STUDENT: 'Estudiantes',
};

export const BOARD_PENDING_STATE_LABELS: Record<ExecutionBoardPendingStateValue, string> = {
  UNMET: 'Pendiente',
  NOT_VERIFIABLE: 'No verificable',
};

export const BOARD_PENDING_LINK_LABELS: Record<ExecutionBoardPendingTargetValue, string> = {
  SCHEDULE: 'Ir al cronograma',
  SESSIONS: 'Ir a sesiones',
  SURVEYS: 'Ir a sesiones',
  MINUTES: 'Ir a sesiones',
  MEASUREMENTS: 'Sin pantalla disponible todavía',
  RESULTS: 'Sin pantalla disponible todavía',
  IMPROVEMENT_PLAN: 'Sin pantalla disponible todavía',
};

export function getExecutionBoardErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'No se pudo cargar el tablero de la ejecución.';
  }

  const apiErr = error as Partial<ApiError>;
  if (apiErr.status === 404) {
    return 'No se encontró la ejecución solicitada.';
  }
  if (apiErr.status === 403) {
    return 'No tienes permiso para ver el tablero de esta ejecución.';
  }
  if (typeof apiErr.status === 'number' && apiErr.status >= 500) {
    return 'No se pudo cargar el tablero por un problema del servidor. Intenta de nuevo en unos minutos.';
  }
  if (typeof apiErr.message === 'string' && apiErr.message.trim().length > 0) {
    return apiErr.message;
  }
  return 'No se pudo cargar el tablero de la ejecución.';
}
