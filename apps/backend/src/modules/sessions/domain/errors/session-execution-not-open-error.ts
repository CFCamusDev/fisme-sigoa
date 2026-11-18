import { ConflictError } from '../../../../shared/errors/app-error.js';

const STATUS_LABELS_ES: Record<string, string> = {
  PLANNED: 'Planificado',
  IN_PROGRESS: 'En ejecución',
  CONSOLIDATING: 'En consolidación',
  PENDING_APPROVAL: 'En aprobación',
  CLOSED: 'Cerrado',
  VOIDED: 'Anulado',
};

export class SessionExecutionNotOpenError extends ConflictError {
  constructor(executionName: string, status: string) {
    const label = STATUS_LABELS_ES[status] ?? status;
    super(
      `La ejecución «${executionName}» está en estado «${label}» y no admite vincular ni editar sesiones.`,
    );
  }
}
