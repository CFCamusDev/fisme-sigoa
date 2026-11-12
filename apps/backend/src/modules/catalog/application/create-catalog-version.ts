import { randomUUID } from 'node:crypto';
import type { CatalogVersionDto } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { CatalogVersion } from '../domain/entities/catalog-version.js';
import {
  CatalogProgramNotFoundError,
  OpenCatalogVersionExistsError,
} from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogProgramReader } from '../domain/ports/catalog-program-reader.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { EducationalObjectiveRepository } from '../domain/ports/educational-objective-repository.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import type { GraduateAttributeRepository } from '../domain/ports/graduate-attribute-repository.js';
import { buildCatalogVersionDto } from './catalog-version-dto.js';
import type { CreateCatalogVersionCommand } from './create-catalog-version.types.js';

export interface CreateCatalogVersionDependencies {
  readonly programReader: CatalogProgramReader;
  readonly versionReader: CatalogVersionReader;
  readonly versionRepository: CatalogVersionRepository;
  readonly objectiveReader: EducationalObjectiveReader;
  readonly objectiveRepository: EducationalObjectiveRepository;
  readonly attributeReader: GraduateAttributeReader;
  readonly attributeRepository: GraduateAttributeRepository;
  readonly permissionChecker: CatalogPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Crea una versión del catálogo en Borrador copiando la vigente (HU-013, RF-013, RS-020).
 * Cabecera, copia de OE y AG y auditoría se confirman en una sola transacción; el bloqueo de la
 * fila del programa serializa las altas simultáneas (D14).
 */
export class CreateCatalogVersionUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: CreateCatalogVersionDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: CreateCatalogVersionCommand): Promise<CatalogVersionDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'catalogo.editar',
      scope: 'GLOBAL',
    });

    const programId = await this.deps.programReader.getCurrentProgramId();
    if (!programId) {
      throw new CatalogProgramNotFoundError();
    }

    return await this.deps.unitOfWork.run(async () => {
      await this.deps.versionRepository.lockProgram(programId);

      if (await this.deps.versionReader.findOpen(programId)) {
        throw new OpenCatalogVersionExistsError();
      }

      const current = await this.deps.versionReader.findCurrent(programId);
      const number = (await this.deps.versionReader.maxNumber(programId)) + 1;
      const now = this.clock();

      const draft = CatalogVersion.createDraft({
        id: this.idGenerator(),
        programId,
        number,
        basedOnVersionId: current?.id ?? null,
        actorId: command.actorId,
        now,
      });
      await this.deps.versionRepository.save(draft);

      let copiedObjectives = 0;
      let copiedAttributes = 0;
      if (current) {
        const objectives = (await this.deps.objectiveReader.listByVersion(current.id)).map((item) =>
          item.copyTo(this.idGenerator(), draft.id, command.actorId, now),
        );
        const attributes = (await this.deps.attributeReader.listByVersion(current.id)).map((item) =>
          item.copyTo(this.idGenerator(), draft.id, command.actorId, now),
        );
        await this.deps.objectiveRepository.insertMany(draft.id, objectives);
        await this.deps.attributeRepository.insertMany(draft.id, attributes);
        copiedObjectives = objectives.length;
        copiedAttributes = attributes.length;
      }

      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'CatalogVersion',
        entityId: draft.id,
        actor: command.actorId,
        ip: command.ip,
        before: null,
        after: { ...draft.snapshot(), copiedObjectives, copiedAttributes },
      });

      return buildCatalogVersionDto(draft, copiedObjectives, copiedAttributes);
    });
  }
}
