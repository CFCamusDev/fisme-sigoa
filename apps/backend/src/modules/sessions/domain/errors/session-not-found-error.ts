import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId: string) {
    super(`No se encontró la sesión con ID «${sessionId}»`);
  }
}
