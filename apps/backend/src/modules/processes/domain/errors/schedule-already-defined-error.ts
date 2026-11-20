import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ScheduleAlreadyDefinedError extends ConflictError {
  constructor() {
    super('El cronograma de esta ejecución ya tiene actividades registradas.');
  }
}
