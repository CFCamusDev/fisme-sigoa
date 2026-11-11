import type { ResponseScaleDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ResponseScaleNotFoundError } from '../domain/errors/index.js';
import { assertScaleEditable } from '../domain/policies/response-scale-editing-policy.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ResponseScaleRepository } from '../domain/ports/response-scale-repository.js';
import type { ScaleLevelRepository } from '../domain/ports/scale-level-repository.js';
import type { ScaleUsageReader } from '../domain/ports/scale-usage-reader.js';
import type { EditResponseScaleCommand } from './edit-response-scale.types.js';
import { buildResponseScaleDto } from './response-scale-dto.js';

export interface EditResponseScaleDependencies {
  readonly scaleRepository: ResponseScaleRepository;
  readonly levelRepository: ScaleLevelRepository;
  readonly scaleUsageReader: ScaleUsageReader;
  readonly permissionChecker: ParametersPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
}

/**
 * Edita el nombre y/o los niveles de una escala que ninguna encuesta publicada usa (HU-012, CA3).
 * Orden de errores (D19): permiso → 404 → 409 en uso → 400 de dominio.
 * La fila se bloquea (`FOR UPDATE`) y, bajo ese bloqueo, se comprueba el uso y se reemplazan los niveles.
 */
export class EditResponseScaleUseCase {
  constructor(private readonly deps: EditResponseScaleDependencies) {}

  async execute(command: EditResponseScaleCommand): Promise<ResponseScaleDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const scale = await this.deps.scaleRepository.lockById(command.id);
      if (!scale) {
        throw new ResponseScaleNotFoundError();
      }

      const inUse = await this.deps.scaleUsageReader.isInUse(scale.id);
      assertScaleEditable({ scale, inUse });

      const before = scale.snapshot();
      if (command.name !== undefined) {
        scale.rename(command.name, command.actorId);
      }
      if (command.levels !== undefined) {
        scale.replaceLevels(command.levels, command.actorId);
      }
      const after = scale.snapshot();

      const nameChanged = before.name !== after.name;
      const levelsChanged = JSON.stringify(before.levels) !== JSON.stringify(after.levels);
      if (!nameChanged && !levelsChanged) {
        // D18: sin cambios no se escribe ni se audita.
        return buildResponseScaleDto(scale, false);
      }

      await this.deps.scaleRepository.save(scale);
      if (levelsChanged) {
        await this.deps.levelRepository.replaceLevels(scale.id, scale.levels);
      }

      await this.deps.auditLogger.log({
        action: 'UPDATE',
        entity: 'ResponseScale',
        entityId: scale.id,
        actor: command.actorId,
        ip: command.ip,
        before,
        after,
      });

      return buildResponseScaleDto(scale, false);
    });
  }
}
