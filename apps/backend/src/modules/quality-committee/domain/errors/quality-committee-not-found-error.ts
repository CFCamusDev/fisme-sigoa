import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class QualityCommitteeNotFoundError extends NotFoundError {
  constructor(committeeId: string) {
    super(`No se encontró el Comité de Calidad con ID «${committeeId}».`);
  }
}
