import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class ProcessSemesterNotFoundError extends NotFoundError {
  constructor(semesterId: string) {
    super(`No existe el semestre indicado (${semesterId})`);
  }
}
