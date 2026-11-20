import { ConflictError } from '../../../../shared/errors/app-error.js';

export class QualityCommitteeOverlapError extends ConflictError {
  constructor(periodStart: string, periodEnd: string) {
    super(
      `El periodo indicado se solapa con un Comité de Calidad ya registrado (${periodStart} al ${periodEnd}).`,
    );
  }
}
