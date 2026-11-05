import { UserDniAlreadyExistsError, UserEmailAlreadyExistsError } from '../errors/index.js';

export interface UserIdentityCheckCandidate {
  id: string;
}

export interface AssertUserIdentityAvailableParams {
  email: string;
  dni: string;
  byEmail: UserIdentityCheckCandidate | null;
  byDni: UserIdentityCheckCandidate | null;
  exceptUserId?: string;
}

export function assertUserIdentityAvailable({
  byEmail,
  byDni,
  exceptUserId,
}: AssertUserIdentityAvailableParams): void {
  // Orden determinista: primero correo, luego DNI
  if (byEmail && byEmail.id !== exceptUserId) {
    throw new UserEmailAlreadyExistsError();
  }

  if (byDni && byDni.id !== exceptUserId) {
    throw new UserDniAlreadyExistsError();
  }
}
