import type { User } from '../entities/user.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByIdForUpdate(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailForUpdate(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  /**
   * Persiste la activación del usuario de forma condicional.
   * Solo actualiza el registro si su estado actual es PENDING_ACTIVATION.
   * Si no se actualiza ninguna fila, lanza UserNotPendingActivationError.
   */
  saveActivation(user: User): Promise<void>;
  /**
   * Persiste el restablecimiento de contraseña de forma condicional.
   * Solo actualiza el registro si su estado actual es ACTIVE (RS-005, RNF-017).
   * Si no se actualiza ninguna fila, lanza UserNotActiveError.
   */
  savePasswordReset(user: User): Promise<void>;
}
