import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class ScheduleActivityNotFoundError extends NotFoundError {
  constructor(activityId: string) {
    super(`No se encontró la actividad de cronograma con identificador «${activityId}».`);
  }
}
