import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class SessionStakeholderListNotFoundError extends NotFoundError {
  constructor(listId: string) {
    super(`No se encontró la lista de constituyentes con ID «${listId}»`);
  }
}
