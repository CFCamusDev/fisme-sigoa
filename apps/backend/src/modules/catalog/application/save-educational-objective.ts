import { randomUUID } from 'node:crypto';
import type { CatalogObjectivesResponse } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { EducationalObjective } from '../domain/entities/educational-objective.js';
import { CatalogItemNotFoundError, CatalogVersionNotFoundError } from '../domain/errors/index.js';
import {
  assertCanAddItem,
  assertCodeAvailable,
  assertVersionEditable,
} from '../domain/policies/catalog-item-rules.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { EducationalObjectiveRepository } from '../domain/ports/educational-objective-repository.js';
import { buildObjectivesResponse } from './catalog-item-dto.js';
import type { SaveEducationalObjectiveCommand } from './save-educational-objective.types.js';

export interface SaveEducationalObjectiveDependencies {
  readonly versionRepository: CatalogVersionRepository;
  readonly objectiveReader: EducationalObjectiveReader;
  readonly objectiveRepository: EducationalObjectiveRepository;
  readonly permissionChecker: CatalogPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

function snapshot(item: EducationalObjective) {
  return {
    versionId: item.versionId,
    code: item.code,
    statement: item.statement,
    order: item.order,
  };
}

/**
 * Agrega o edita un OE de una versión en Borrador (HU-014, RF-014, RS-020). La versión se bloquea
 * antes de evaluar su estado (D5); una edición sin cambios no escribe ni audita (D10).
 */
export class SaveEducationalObjectiveUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: SaveEducationalObjectiveDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: SaveEducationalObjectiveCommand): Promise<CatalogObjectivesResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'catalogo.editar',
      scope: 'GLOBAL',
    });

    return await this.deps.unitOfWork.run(async () => {
      const version = await this.deps.versionRepository.lockForEdit(command.versionId);
      if (!version) {
        throw new CatalogVersionNotFoundError();
      }
      assertVersionEditable(version.status);

      const items = await this.deps.objectiveReader.listByVersion(version.id);
      const now = this.clock();

      if (command.id) {
        const current = items.find((item) => item.id === command.id);
        if (!current) {
          throw new CatalogItemNotFoundError();
        }
        const edited = current.edit({
          code: command.code,
          statement: command.statement,
          actorId: command.actorId,
          now,
        });
        assertCodeAvailable(edited.code, items, current.id);
        if (current.hasSameContent({ code: edited.code, statement: edited.statement })) {
          return buildObjectivesResponse(items);
        }
        await this.deps.objectiveRepository.update(edited);
        await this.deps.auditLogger.log({
          action: 'UPDATE',
          entity: 'EducationalObjective',
          entityId: edited.id,
          actor: command.actorId,
          ip: command.ip,
          before: snapshot(current),
          after: snapshot(edited),
        });
      } else {
        assertCanAddItem(items.length);
        const order = items.reduce((max, item) => Math.max(max, item.order), 0) + 1;
        const created = EducationalObjective.createNew({
          id: this.idGenerator(),
          versionId: version.id,
          code: command.code,
          statement: command.statement,
          order,
          actorId: command.actorId,
          now,
        });
        assertCodeAvailable(created.code, items);
        await this.deps.objectiveRepository.insert(created);
        await this.deps.auditLogger.log({
          action: 'CREATE',
          entity: 'EducationalObjective',
          entityId: created.id,
          actor: command.actorId,
          ip: command.ip,
          before: null,
          after: snapshot(created),
        });
      }

      return buildObjectivesResponse(await this.deps.objectiveReader.listByVersion(version.id));
    });
  }
}
