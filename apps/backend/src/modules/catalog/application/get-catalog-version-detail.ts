import { catalogVersionDetailDtoSchema, type CatalogVersionDetailDto } from '@sigoa/shared';
import { CatalogVersionNotFoundError } from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { mapAttributeToDto, mapObjectiveToDto } from './catalog-item-dto.js';
import { mapCatalogVersionToDto } from './catalog-version-dto.js';

export interface GetCatalogVersionDetailDependencies {
  readonly versionReader: CatalogVersionReader;
  readonly objectiveReader: EducationalObjectiveReader;
  readonly attributeReader: GraduateAttributeReader;
  readonly permissionChecker: CatalogPermissionChecker;
}

export interface GetCatalogVersionDetailQuery {
  readonly actorId: string;
  readonly versionId: string;
}

/**
 * Devuelve una versión del catálogo con sus OE y AG ordenados (HU-014, RF-014). Es una lectura:
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

    const [objectives, attributes] = await Promise.all([
      this.deps.objectiveReader.listByVersion(version.id),
      this.deps.attributeReader.listByVersion(version.id),
    ]);

    return catalogVersionDetailDtoSchema.parse({
      version: mapCatalogVersionToDto(version, objectives.length, attributes.length),
      objectives: objectives.map(mapObjectiveToDto),
      attributes: attributes.map(mapAttributeToDto),
    });
  }
}
