import type { CatalogAttributesResponse, CatalogObjectivesResponse } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { CatalogVersionNotFoundError } from '../domain/errors/index.js';
import {
  assertVersionEditable,
  planReorder,
  type CatalogItemRef,
} from '../domain/policies/catalog-item-rules.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { EducationalObjectiveRepository } from '../domain/ports/educational-objective-repository.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import type { GraduateAttributeRepository } from '../domain/ports/graduate-attribute-repository.js';
import { buildAttributesResponse, buildObjectivesResponse } from './catalog-item-dto.js';
import type { ReorderCatalogItemsCommand } from './reorder-catalog-items.types.js';

export interface ReorderCatalogItemsDependencies {
  readonly versionRepository: CatalogVersionRepository;
  readonly objectiveReader: EducationalObjectiveReader;
  readonly objectiveRepository: EducationalObjectiveRepository;
  readonly attributeReader: GraduateAttributeReader;
  readonly attributeRepository: GraduateAttributeRepository;
  readonly permissionChecker: CatalogPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly clock?: () => Date;
}

const codesOf = (items: readonly CatalogItemRef[]) => items.map((item) => item.code);

/**
 * Reordena los OE o los AG de una versión en Borrador (HU-014, RF-014, RS-020). La lista de ids
 * debe coincidir exactamente con los elementos actuales; el orden queda 1…n sin huecos. Si el
 * orden ya es el pedido no escribe ni audita (D10).
 */
export class ReorderCatalogItemsUseCase {
  private readonly clock: () => Date;

  constructor(private readonly deps: ReorderCatalogItemsDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  execute(command: ReorderCatalogItemsCommand<'OBJECTIVES'>): Promise<CatalogObjectivesResponse>;
  execute(command: ReorderCatalogItemsCommand<'ATTRIBUTES'>): Promise<CatalogAttributesResponse>;
  async execute(
    command: ReorderCatalogItemsCommand,
  ): Promise<CatalogObjectivesResponse | CatalogAttributesResponse> {
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

      const isObjectives = command.kind === 'OBJECTIVES';
      const reader = isObjectives ? this.deps.objectiveReader : this.deps.attributeReader;
      const repository = isObjectives
        ? this.deps.objectiveRepository
        : this.deps.attributeRepository;

      const items = await reader.listByVersion(version.id);
      const plan = planReorder(items, command.orderedIds);
      const currentOrders = new Map(items.map((item) => [item.id, item.order]));
      const changes = plan.filter((entry) => currentOrders.get(entry.id) !== entry.order);

      if (changes.length > 0) {
        const now = this.clock();
        await repository.updateOrders(version.id, changes, command.actorId, now);
        const codeById = new Map(items.map((item) => [item.id, item.code]));
        await this.deps.auditLogger.log({
          action: 'UPDATE',
          entity: 'CatalogVersion',
          entityId: version.id,
          actor: command.actorId,
          ip: command.ip,
          before: { kind: command.kind, orderedCodes: codesOf(items) },
          after: {
            kind: command.kind,
            orderedCodes: command.orderedIds.map((id) => codeById.get(id) ?? id),
          },
        });
      }

      return isObjectives
        ? buildObjectivesResponse(await this.deps.objectiveReader.listByVersion(version.id))
        : buildAttributesResponse(await this.deps.attributeReader.listByVersion(version.id));
    });
  }
}
