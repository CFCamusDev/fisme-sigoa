import { randomUUID } from 'node:crypto';
import type { ResponseScaleDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ResponseScale } from '../domain/entities/response-scale.js';
import { ResponseScaleCodeAlreadyExistsError } from '../domain/errors/index.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ResponseScaleReader } from '../domain/ports/response-scale-reader.js';
import type { ResponseScaleRepository } from '../domain/ports/response-scale-repository.js';
import type { ScaleLevelRepository } from '../domain/ports/scale-level-repository.js';
import type { CreateResponseScaleCommand } from './create-response-scale.types.js';
import { buildResponseScaleDto } from './response-scale-dto.js';

export interface CreateResponseScaleDependencies {
  readonly scaleReader: ResponseScaleReader;
  readonly scaleRepository: ResponseScaleRepository;
  readonly levelRepository: ScaleLevelRepository;
  readonly permissionChecker: ParametersPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Crea una escala de respuesta con sus niveles (HU-012, RF-012, RS-020).
 * Cabecera, niveles y auditoría se confirman en una sola transacción.
 */
export class CreateResponseScaleUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: CreateResponseScaleDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: CreateResponseScaleCommand): Promise<ResponseScaleDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });

    const now = this.clock();
    const scale = ResponseScale.create({
      id: this.idGenerator(),
      code: command.code,
      name: command.name,
      type: command.type,
      levels: ResponseScale.levelsFromInputs(command.levels),
      createdBy: command.actorId,
      updatedBy: command.actorId,
      createdAt: now,
      updatedAt: now,
    });

    return await this.deps.unitOfWork.run(async () => {
      // La restricción única es la garantía; esta lectura solo mejora el mensaje (D17).
      if (await this.deps.scaleReader.findByCode(scale.code)) {
        throw new ResponseScaleCodeAlreadyExistsError();
      }

      await this.deps.scaleRepository.save(scale);
      await this.deps.levelRepository.replaceLevels(scale.id, scale.levels);

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'ResponseScale',
        entityId: scale.id,
        actor: command.actorId,
        ip: command.ip,
        before: null,
        after: scale.snapshot(),
      });

      return buildResponseScaleDto(scale, false);
    });
  }
}
