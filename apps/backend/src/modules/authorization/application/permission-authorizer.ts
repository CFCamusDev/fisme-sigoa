import { ForbiddenError } from '../../../shared/errors/app-error.js';
import {
  computeEffectivePermissions,
  evaluateResourceAccess,
  isGranted,
  isPermissionCode,
  type AccessDenial,
  type AccessDenialRecorder,
  type GrantReader,
  type PermissionScope,
  type ResourceRef,
} from '../domain/index.js';
import { ResourceOwnershipRegistry } from './resource-ownership-registry.js';

export interface AuthorizationMeta {
  readonly method?: string;
  readonly route?: string;
}

export interface AssertAllowedParams {
  readonly actorId: string;
  readonly permission: string;
  readonly scope: PermissionScope;
  readonly meta?: AuthorizationMeta;
}

export interface AssertAllowedOnResourceParams {
  readonly actorId: string;
  readonly permission: string;
  readonly resource: ResourceRef;
  readonly meta?: AuthorizationMeta;
}

const FORBIDDEN_MESSAGE = 'No tienes permiso para realizar esta acción.';

export class PermissionAuthorizer {
  private readonly ownershipRegistry: ResourceOwnershipRegistry;

  public constructor(
    private readonly grantReader: GrantReader,
    private readonly recorder?: AccessDenialRecorder,
    ownershipRegistry?: ResourceOwnershipRegistry,
  ) {
    this.ownershipRegistry = ownershipRegistry ?? new ResourceOwnershipRegistry();
  }

  public async assertAllowed(params: AssertAllowedParams): Promise<void> {
    // 1. Falla cerrado si el código de permiso no pertenece al catálogo oficial
    if (!isPermissionCode(params.permission)) {
      await this.recordDenialSafely({
        actorId: params.actorId,
        permission: params.permission,
        requiredScope: params.scope,
        grantedScope: null,
        reason: 'UNKNOWN_PERMISSION',
        ...(params.meta?.method !== undefined ? { method: params.meta.method } : {}),
        ...(params.meta?.route !== undefined ? { route: params.meta.route } : {}),
      });
      throw new ForbiddenError(FORBIDDEN_MESSAGE);
    }

    // 2. Obtener concesiones otorgadas al usuario por sus roles y permisos directos
    const grants = await this.grantReader.findGrantsByUserId(params.actorId);

    // 3. Calcular permisos efectivos
    const effective = computeEffectivePermissions(grants);

    // 4. Evaluar si el permiso y alcance requeridos están cubiertos
    if (!isGranted(effective, params.permission, params.scope)) {
      const grantedScope = effective.get(params.permission) ?? null;
      await this.recordDenialSafely({
        actorId: params.actorId,
        permission: params.permission,
        requiredScope: params.scope,
        grantedScope,
        reason: grantedScope ? 'SCOPE_INSUFFICIENT' : 'MISSING_PERMISSION',
        ...(params.meta?.method !== undefined ? { method: params.meta.method } : {}),
        ...(params.meta?.route !== undefined ? { route: params.meta.route } : {}),
      });
      throw new ForbiddenError(FORBIDDEN_MESSAGE);
    }
  }

  public async assertAllowedOnResource(params: AssertAllowedOnResourceParams): Promise<void> {
    if (!isPermissionCode(params.permission)) {
      await this.recordDenialSafely({
        actorId: params.actorId,
        permission: params.permission,
        requiredScope: 'OWN',
        grantedScope: null,
        reason: 'UNKNOWN_PERMISSION',
        resourceType: params.resource.type,
        resourceId: params.resource.id,
        ...(params.meta?.method !== undefined ? { method: params.meta.method } : {}),
        ...(params.meta?.route !== undefined ? { route: params.meta.route } : {}),
      });
      throw new ForbiddenError(FORBIDDEN_MESSAGE);
    }

    const grants = await this.grantReader.findGrantsByUserId(params.actorId);
    const effective = computeEffectivePermissions(grants);
    const grantedScope = effective.get(params.permission) ?? null;

    if (grantedScope === 'GLOBAL') {
      return;
    }

    const ownership =
      grantedScope === 'OWN'
        ? await this.ownershipRegistry.resolve(params.actorId, params.resource)
        : undefined;

    const decision = evaluateResourceAccess({
      effective,
      permission: params.permission,
      ...(ownership !== undefined ? { ownership } : {}),
    });

    if (!decision.allowed) {
      await this.recordDenialSafely({
        actorId: params.actorId,
        permission: params.permission,
        requiredScope: 'OWN',
        grantedScope,
        reason: decision.reason,
        resourceType: params.resource.type,
        resourceId: params.resource.id,
        ...(params.meta?.method !== undefined ? { method: params.meta.method } : {}),
        ...(params.meta?.route !== undefined ? { route: params.meta.route } : {}),
      });
      throw new ForbiddenError(FORBIDDEN_MESSAGE);
    }
  }

  protected async recordDenialSafely(denial: AccessDenial): Promise<void> {
    if (!this.recorder) {
      return;
    }
    try {
      await this.recorder.record(denial);
    } catch {
      // D4: un fallo en el registrador nunca convierte una denegación 403 en 500
    }
  }
}
