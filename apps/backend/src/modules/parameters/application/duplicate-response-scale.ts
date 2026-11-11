import { randomUUID } from 'node:crypto';
import type { ResponseScaleDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  ResponseScaleCodeAlreadyExistsError,
  ResponseScaleNotFoundError,
} from '../domain/errors/index.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ResponseScaleReader } from '../domain/ports/response-scale-reader.js';
import type { ResponseScaleRepository } from '../domain/ports/response-scale-repository.js';
import type { ScaleLevelRepository } from '../domain/ports/scale-level-repository.js';
import type { DuplicateResponseScaleCommand } from './duplicate-response-scale.types.js';
import { buildResponseScaleDto } from './response-scale-dto.js';

export interface DuplicateResponseScaleDependencies {
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
 * Duplica una escala (en uso o no) en otra nueva y editable: es la salida de CA3 (HU-012, RF-012).
 * Bloquea la fila origen para no copiar una versión intermedia (D20).
 */
export class DuplicateResponseScaleUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: DuplicateResponseScaleDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: DuplicateResponseScaleCommand): Promise<ResponseScaleDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const source = await this.deps.scaleRepository.lockById(command.sourceId);
      if (!source) {
        throw new ResponseScaleNotFoundError();
      }

      const copy = source.duplicate(
        this.idGenerator(),
        command.code,
        command.name,
        command.actorId,
        this.clock(),
      );

      // La restricción única es la garantía; esta lectura solo mejora el mensaje (D17).
      if (await this.deps.scaleReader.findByCode(copy.code)) {
        throw new ResponseScaleCodeAlreadyExistsError();
      }

      await this.deps.scaleRepository.save(copy);
      await this.deps.levelRepository.replaceLevels(copy.id, copy.levels);

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'ResponseScale',
        entityId: copy.id,
        actor: command.actorId,
        ip: command.ip,
        before: null,
        after: { ...copy.snapshot(), duplicatedFrom: source.code },
      });

      return buildResponseScaleDto(copy, false);
    });
  }
}
