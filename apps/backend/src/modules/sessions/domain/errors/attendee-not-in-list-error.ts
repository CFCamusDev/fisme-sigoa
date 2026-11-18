import { ConflictError } from '../../../../shared/errors/app-error.js';

export class AttendeeNotInListError extends ConflictError {
  constructor(memberIdentifier: string) {
    super(
      `La persona «${memberIdentifier}» no pertenece a la lista del Anexo 3 de la sesión; agrégalo primero a la lista.`,
    );
  }
}
