import type { CatalogVersionDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { CatalogVersion } from '../domain/entities/catalog-version.js';
import {
  CatalogVersionNotFoundError,
  InvalidCatalogTransitionError,
} from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { planActivation } from '../domain/policies/catalog-activation-policy.js';
import type { ActivateCatalogVersionCommand } from './activate-catalog-version.types.js';
import { buildCatalogVersionDto } from './catalog-version-dto.js';

export interface ActivateCatalogVersionDependencies {
  readonly versionReader: CatalogVersionReader;
  readonly versionRepository: CatalogVersionRepository;
  readonly objectiveReader: EducationalObjectiveReader;
  readonly attributeReader: GraduateAttributeReader;
  readonly permissionChecker: CatalogPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

/**
 * Activa una versión En validación al aprobarse su resolución (HU-016, RF-016, RS-020, RNF-022):
 * la versión pasa a Aprobada (vigente) y la anterior a Histórica, con su auditoría, dentro de la
 * transacción de la aprobación (`unitOfWork.run` se une a la activa). Bloquea resolución →
 * programa → versión; si la versión ya es la vigente no hace nada (idempotente, D4).
 */
export class ActivateCatalogVersionUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: ActivateCatalogVersionDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: ActivateCatalogVersionCommand): Promise<CatalogVersionDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'resolucion.aprobar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      // El programa de una versión es inmutable: se lee antes de bloquear para fijar el orden.
      const found = await this.deps.versionReader.findById(command.versionId);
      if (!found) {
        throw new CatalogVersionNotFoundError();
      }

      await this.deps.versionRepository.lockProgram(found.programId);
      const candidate = await this.deps.versionRepository.lockForEdit(command.versionId);
      if (!candidate) {
        throw new CatalogVersionNotFoundError();
      }
      const current = await this.deps.versionReader.findCurrent(candidate.programId);

      const plan = planActivation({ candidate, current });
      if (plan.outcome === 'ALREADY_CURRENT') {
        return await this.toDto(candidate);
      }

      const now = this.clock();

      if (plan.supersedeVersionId && current) {
        const superseded = current.supersede({ actorId: command.actorId, now });
        await this.transition(current, superseded, command, now);
        await this.deps.auditLogger.log({
          action: 'STATE_CHANGE',
          entity: 'CatalogVersion',
          entityId: current.id,
          actor: command.actorId,
          ip: command.ip,
          before: { status: current.status },
          after: {
            status: superseded.status,
            supersededBy: candidate.id,
            resolutionId: command.resolutionId,
          },
        });
      }

      const activated = candidate.activate({ actorId: command.actorId, now });
      await this.transition(candidate, activated, command, now);
      await this.deps.auditLogger.log({
        action: 'STATE_CHANGE',
        entity: 'CatalogVersion',
        entityId: candidate.id,
        actor: command.actorId,
        ip: command.ip,
        before: { status: candidate.status },
        after: { status: activated.status, resolutionId: command.resolutionId },
      });

      return await this.toDto(activated);
    });
  }

  /** Transición condicional: si otra transacción cambió el estado, no gana y responde 409. */
  private async transition(
    from: CatalogVersion,
    to: CatalogVersion,
    command: ActivateCatalogVersionCommand,
    now: Date,
  ): Promise<void> {
    const changed = await this.deps.versionRepository.transitionStatus(
      from.id,
      from.status,
      to.status,
      command.actorId,
      now,
    );
    if (!changed) {
      throw new InvalidCatalogTransitionError();
    }
  }

  private async toDto(version: CatalogVersion): Promise<CatalogVersionDto> {
    const [objectives, attributes] = await Promise.all([
      this.deps.objectiveReader.listByVersion(version.id),
      this.deps.attributeReader.listByVersion(version.id),
    ]);
    return buildCatalogVersionDto(version, objectives.length, attributes.length);
  }
}
