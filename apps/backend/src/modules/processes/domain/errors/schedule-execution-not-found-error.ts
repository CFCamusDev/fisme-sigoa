import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class ScheduleExecutionNotFoundError extends NotFoundError {
  constructor(executionId: string) {
    super(`No se encontró la ejecución de proceso con identificador «${executionId}».`);
  }
}
