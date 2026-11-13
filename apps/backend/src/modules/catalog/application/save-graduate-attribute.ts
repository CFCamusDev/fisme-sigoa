import { randomUUID } from 'node:crypto';
import type { CatalogAttributesResponse } from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { GraduateAttribute } from '../domain/entities/graduate-attribute.js';
import { CatalogItemNotFoundError, CatalogVersionNotFoundError } from '../domain/errors/index.js';
import {
  assertCanAddItem,
  assertCodeAvailable,
  assertVersionEditable,
} from '../domain/policies/catalog-item-rules.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionRepository } from '../domain/ports/catalog-version-repository.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import type { GraduateAttributeRepository } from '../domain/ports/graduate-attribute-repository.js';
import { buildAttributesResponse } from './catalog-item-dto.js';
import type { SaveGraduateAttributeCommand } from './save-graduate-attribute.types.js';

export interface SaveGraduateAttributeDependencies {
  readonly versionRepository: CatalogVersionRepository;
  readonly attributeReader: GraduateAttributeReader;
  readonly attributeRepository: GraduateAttributeRepository;
  readonly permissionChecker: CatalogPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

function snapshot(item: GraduateAttribute) {
  return {
    versionId: item.versionId,
    code: item.code,
    name: item.name,
    statement: item.statement,
    order: item.order,
  };
}

/**
 * Agrega o edita un AG de una versión en Borrador (HU-014, RF-014, RS-020). La versión se bloquea
 * antes de evaluar su estado (D5); una edición sin cambios no escribe ni audita (D10).
 */
export class SaveGraduateAttributeUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: SaveGraduateAttributeDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: SaveGraduateAttributeCommand): Promise<CatalogAttributesResponse> {
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

      const items = await this.deps.attributeReader.listByVersion(version.id);
      const now = this.clock();

      if (command.id) {
        const current = items.find((item) => item.id === command.id);
        if (!current) {
          throw new CatalogItemNotFoundError();
        }
        const edited = current.edit({
          code: command.code,
          name: command.name,
          statement: command.statement,
          actorId: command.actorId,
          now,
        });
        assertCodeAvailable(edited.code, items, current.id);
        if (
          current.hasSameContent({
            code: edited.code,
            name: edited.name,
            statement: edited.statement,
          })
        ) {
          return buildAttributesResponse(items);
        }
        await this.deps.attributeRepository.update(edited);
        await this.deps.auditLogger.log({
          action: 'UPDATE',
          entity: 'GraduateAttribute',
          entityId: edited.id,
          actor: command.actorId,
          ip: command.ip,
          before: snapshot(current),
          after: snapshot(edited),
        });
      } else {
        assertCanAddItem(items.length);
        const order = items.reduce((max, item) => Math.max(max, item.order), 0) + 1;
        const created = GraduateAttribute.createNew({
          id: this.idGenerator(),
          versionId: version.id,
          code: command.code,
          name: command.name,
          statement: command.statement,
          order,
          actorId: command.actorId,
          now,
        });
        assertCodeAvailable(created.code, items);
        await this.deps.attributeRepository.insert(created);
        await this.deps.auditLogger.log({
          action: 'CREATE',
          entity: 'GraduateAttribute',
          entityId: created.id,
          actor: command.actorId,
          ip: command.ip,
          before: null,
          after: snapshot(created),
        });
      }

      return buildAttributesResponse(await this.deps.attributeReader.listByVersion(version.id));
    });
  }
}
