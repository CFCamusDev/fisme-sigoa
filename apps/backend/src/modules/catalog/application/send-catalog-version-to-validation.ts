import type { CatalogVersionDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  CatalogVersionNotFoundError,
  InvalidCatalogTransitionError,
} from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { buildCatalogVersionDto } from './catalog-version-dto.js';
import type { SendCatalogVersionToValidationCommand } from './send-catalog-version-to-validation.types.js';

export interface SendCatalogVersionToValidationDependencies {
  readonly versionRepository: CatalogVersionRepository;
  readonly objectiveReader: EducationalObjectiveReader;
  readonly attributeReader: GraduateAttributeReader;
  readonly permissionChecker: CatalogPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Envía una versión en Borrador a validación (HU-015, RF-015, RS-020, RS-023). Bloqueo de fila,
 * conteo de OE y AG, transición condicional, auditoría y DTO se resuelven en una sola
 * transacción: de dos envíos simultáneos solo uno gana y el otro recibe un 409 (D3, D4).
 */
export class SendCatalogVersionToValidationUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: SendCatalogVersionToValidationDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: SendCatalogVersionToValidationCommand): Promise<CatalogVersionDto> {
    // Borrador → En validación exige `catalogo.editar` (RS 5.3, `requiredPermission`).
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'catalogo.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const current = await this.deps.versionRepository.lockForEdit(command.versionId);
      if (!current) {
        throw new CatalogVersionNotFoundError();
      }

      const [objectives, attributes] = await Promise.all([
        this.deps.objectiveReader.listByVersion(current.id),
        this.deps.attributeReader.listByVersion(current.id),
      ]);

      const now = this.clock();
      const sent = current.sendToValidation({
        objectiveCount: objectives.length,
        attributeCount: attributes.length,
        actorId: command.actorId,
        now,
      });

      const changed = await this.deps.versionRepository.transitionStatus(
        current.id,
        current.status,
        sent.status,
        command.actorId,
        now,
      );
      if (!changed) {
        throw new InvalidCatalogTransitionError();
      }

      await this.deps.auditLogger.log({
        action: 'STATE_CHANGE',
        entity: 'CatalogVersion',
        entityId: current.id,
        actor: command.actorId,
        ip: command.ip,
        before: { status: current.status },
        after: {
          status: sent.status,
          objectiveCount: objectives.length,
          attributeCount: attributes.length,
        },
      });

      return buildCatalogVersionDto(sent, objectives.length, attributes.length);
    });
  }
}
