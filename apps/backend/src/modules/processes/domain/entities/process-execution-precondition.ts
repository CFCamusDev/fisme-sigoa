export const EXECUTION_PRECONDITION_CODES = [
  'SCHEDULE_HAS_ACTIVITY',
  'SESSIONS_SURVEYS_CLOSED',
  'SESSIONS_MINUTES_SIGNED',
  'MEASUREMENTS_REVIEWED',
  'CONSOLIDATION_MINUTES_SIGNED',
  'RESULTS_CALCULATED',
  'IMPROVEMENT_ACTIONS_REGISTERED',
  'RESOLUTION_APPROVED',
] as const;

export type ExecutionPreconditionCode = (typeof EXECUTION_PRECONDITION_CODES)[number];

export const PRECONDITION_STATES = ['MET', 'UNMET', 'NOT_VERIFIABLE'] as const;

export type PreconditionState = (typeof PRECONDITION_STATES)[number];

export interface ExecutionPreconditionResult {
  readonly code: ExecutionPreconditionCode;
  readonly label: string;
  readonly state: PreconditionState;
}

export const PRECONDITION_LABELS: Record<ExecutionPreconditionCode, string> = {
  SCHEDULE_HAS_ACTIVITY: 'El cronograma tiene al menos una actividad registrada',
  SESSIONS_SURVEYS_CLOSED: 'Todas las encuestas de las sesiones están cerradas',
  SESSIONS_MINUTES_SIGNED: 'Las actas de las sesiones están firmadas',
  MEASUREMENTS_REVIEWED: 'Las mediciones directas de los cursos están revisadas',
  CONSOLIDATION_MINUTES_SIGNED: 'El acta de consolidación está firmada',
  RESULTS_CALCULATED: 'Los resultados del proceso han sido calculados',
  IMPROVEMENT_ACTIONS_REGISTERED: 'Las acciones de mejora están registradas',
  RESOLUTION_APPROVED: 'La resolución que aprueba el proceso está aprobada con su PDF',
};
