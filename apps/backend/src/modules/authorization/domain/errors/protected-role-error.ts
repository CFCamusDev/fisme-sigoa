import { ConflictError } from '../../../../shared/errors/app-error.js';

export class ProtectedRoleError extends ConflictError {
  constructor(
    message = 'El rol Administrador debe conservar los permisos rol.ver y rol.editar con alcance Global.',
  ) {
    super(message);
  }
}
