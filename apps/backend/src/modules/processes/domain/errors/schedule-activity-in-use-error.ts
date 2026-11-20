import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ScheduleActivityInUseError extends ConflictError {
  constructor() {
    super('No se puede eliminar una actividad que ya está en curso o completada.');
  }
}
