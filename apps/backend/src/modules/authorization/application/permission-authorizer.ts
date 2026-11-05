import { ForbiddenError } from '../../../shared/errors/app-error.js';
import {
  computeEffectivePermissions,
  isGranted,
  isPermissionCode,
  type GrantReader,
  type PermissionScope,
} from '../domain/index.js';

export interface AssertAllowedParams {
  readonly actorId: string;
  readonly permission: string;
  readonly scope: PermissionScope;
}

export class PermissionAuthorizer {
  public constructor(private readonly grantReader: GrantReader) {}

  public async assertAllowed(params: AssertAllowedParams): Promise<void> {
    // 1. Falla cerrado si el código de permiso no pertenece al catálogo oficial
    if (!isPermissionCode(params.permission)) {
      throw new ForbiddenError('No tienes permiso para realizar esta acción.');
    }

    // 2. Obtener concesiones otorgadas al usuario por sus roles
    const grants = await this.grantReader.findGrantsByUserId(params.actorId);

    // 3. Calcular permisos efectivos
    const effective = computeEffectivePermissions(grants);

    // 4. Evaluar si el permiso y alcance requeridos están cubiertos
    if (!isGranted(effective, params.permission, params.scope)) {
      throw new ForbiddenError('No tienes permiso para realizar esta acción.');
    }
  }
}
