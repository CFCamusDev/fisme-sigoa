import { ConflictError } from '../../../../shared/errors/app-error.js';

/** El correo o el DNI de ADMIN_* ya pertenece a un usuario que no es administrador. */
export class BootstrapAdminConflictError extends ConflictError {
  public readonly variable: 'ADMIN_EMAIL' | 'ADMIN_DNI';

  constructor(variable: 'ADMIN_EMAIL' | 'ADMIN_DNI') {
    super(
      `No se puede crear el primer administrador: ${variable} ya pertenece a otro usuario. Corrige esa variable.`,
    );
    this.variable = variable;
  }
}
