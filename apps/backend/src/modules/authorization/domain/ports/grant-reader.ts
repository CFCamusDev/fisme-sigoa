import type { Grant } from '../policies/effective-permissions.js';

export interface GrantReader {
  /**
   * Obtiene todas las concesiones de permisos otorgadas a un usuario a través de sus roles.
   */
  findGrantsByUserId(userId: string): Promise<Grant[]>;
}
