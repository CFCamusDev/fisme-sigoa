import { catalogVersionDetailDtoSchema, type CatalogVersionDetailDto } from '@sigoa/shared';
import { CatalogVersionNotFoundError } from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionHistoryReader } from '../domain/ports/catalog-version-history-reader.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { mapAttributeToDto, mapObjectiveToDto } from './catalog-item-dto.js';
import { buildVersionHistoryDto } from './catalog-version-history-dto.js';
import { mapCatalogVersionToDto } from './catalog-version-dto.js';

export interface GetCatalogVersionDetailDependencies {
  readonly versionReader: CatalogVersionReader;
  readonly objectiveReader: EducationalObjectiveReader;
  readonly attributeReader: GraduateAttributeReader;
  readonly historyReader: CatalogVersionHistoryReader;
  readonly permissionChecker: CatalogPermissionChecker;
}

export interface GetCatalogVersionDetailQuery {
  readonly actorId: string;
  readonly versionId: string;
}

/**
 * Devuelve una versión del catálogo con sus OE y AG ordenados (HU-014, RF-014) y con su
 * resolución y vigencia (HU-017, CA2). Es una lectura:
 * sin transacción ni auditoría. No expone datos de quien creó o editó cada elemento.
 */
export class GetCatalogVersionDetailUseCase {
  constructor(private readonly deps: GetCatalogVersionDetailDependencies) {}

  async execute(query: GetCatalogVersionDetailQuery): Promise<CatalogVersionDetailDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'catalogo.ver',
      scope: 'GLOBAL',
    });

    const version = await this.deps.versionReader.findById(query.versionId);
    if (!version) {
      throw new CatalogVersionNotFoundError();
    }

    const [objectives, attributes, programVersions, resolutions] = await Promise.all([
      this.deps.objectiveReader.listByVersion(version.id),
      this.deps.attributeReader.listByVersion(version.id),
      this.deps.versionReader.list(version.programId),
      this.deps.historyReader.listForProgram(version.programId),
    ]);

    return catalogVersionDetailDtoSchema.parse({
      version: mapCatalogVersionToDto(version, objectives.length, attributes.length),
      history: buildVersionHistoryDto(version.id, programVersions, resolutions),
      objectives: objectives.map(mapObjectiveToDto),
      attributes: attributes.map(mapAttributeToDto),
    });
  }
}
