import { ConflictError } from '../../../../shared/errors/app-error.js';

export class QualityCommitteeClosedError extends ConflictError {
  constructor(periodStart: string, periodEnd: string) {
    super(
      `El Comité de Calidad del periodo ${periodStart} al ${periodEnd} ya finalizó y no puede modificarse.`,
    );
  }
}
