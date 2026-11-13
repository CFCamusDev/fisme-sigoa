import { randomUUID } from 'node:crypto';
import type { ResolutionDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Resolution } from '../domain/entities/resolution.js';
import {
  ResolutionVersionNotFoundError,
  ResolutionVersionNotInValidationError,
} from '../domain/errors/index.js';
import type { ResolutionCatalogVersionReader } from '../domain/ports/resolution-catalog-version-reader.js';
import type { ResolutionPermissionChecker } from '../domain/ports/resolution-permission-checker.js';
import type { ResolutionRepository } from '../domain/ports/resolution-repository.js';
import type { RegisterResolutionCommand } from './register-resolution.types.js';
import { buildResolutionDto } from './resolution-dto.js';

export interface RegisterResolutionDependencies {
  readonly versionReader: ResolutionCatalogVersionReader;
  readonly resolutionRepository: ResolutionRepository;
  readonly permissionChecker: ResolutionPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Registra la resolución del Decano vinculada a una versión En validación (HU-048, RF-048,
 * RN-063, RS-020). Lectura de la versión, alta y auditoría se confirman en una sola transacción;
 * la unicidad la garantizan las restricciones de la base (un duplicado devuelve 409).
 */
export class RegisterResolutionUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: RegisterResolutionDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: RegisterResolutionCommand): Promise<ResolutionDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'resolucion.registrar',
      scope: 'GLOBAL',
    });

    // Reglas del dominio (tipo, número, fecha, vínculo) antes de abrir la transacción.
    const resolution = Resolution.register({
      id: this.idGenerator(),
      type: command.type,
      number: command.number,
      issuedOn: new Date(`${command.issuedOn}T00:00:00.000Z`),
      catalogVersionId: command.catalogVersionId,
      actorId: command.actorId,
      now: this.clock(),
    });

    return await this.deps.unitOfWork.run(async () => {
      const version = await this.deps.versionReader.findById(command.catalogVersionId);
      if (!version) {
        throw new ResolutionVersionNotFoundError();
      }
      if (version.status !== 'IN_VALIDATION') {
        throw new ResolutionVersionNotInValidationError();
      }

      await this.deps.resolutionRepository.save(resolution);

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'Resolution',
        entityId: resolution.id,
        actor: command.actorId,
        ip: command.ip,
        before: null,
        after: resolution.snapshot(),
      });

      return buildResolutionDto(resolution);
    });
  }
}
