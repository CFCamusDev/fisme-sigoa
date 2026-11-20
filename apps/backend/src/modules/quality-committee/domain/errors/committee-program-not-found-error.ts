import { ConflictError } from '../../../../shared/errors/app-error.js';

export class CommitteeProgramNotFoundError extends ConflictError {
  constructor() {
    super('No se encontró un programa académico registrado para asociar el Comité de Calidad.');
  }
}
