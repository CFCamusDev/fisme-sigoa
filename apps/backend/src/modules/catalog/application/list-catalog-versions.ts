import { listCatalogVersionsResponseSchema, type ListCatalogVersionsResponse } from '@sigoa/shared';
import { CatalogProgramNotFoundError } from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogProgramReader } from '../domain/ports/catalog-program-reader.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { mapCatalogVersionToDto } from './catalog-version-dto.js';
import type { ListCatalogVersionsQuery } from './list-catalog-versions.types.js';

export interface ListCatalogVersionsDependencies {
  readonly programReader: CatalogProgramReader;
  readonly versionReader: CatalogVersionReader;
  readonly objectiveReader: EducationalObjectiveReader;
  readonly attributeReader: GraduateAttributeReader;
  readonly permissionChecker: CatalogPermissionChecker;
}

/**
 * Lista las versiones del catálogo con sus conteos de OE y AG (HU-013, RF-013).
 * Es una lectura: sin transacción ni auditoría. Los conteos salen de dos consultas agrupadas.
 */
export class ListCatalogVersionsUseCase {
  constructor(private readonly deps: ListCatalogVersionsDependencies) {}

  async execute(query: ListCatalogVersionsQuery): Promise<ListCatalogVersionsResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'catalogo.ver',
      scope: 'GLOBAL',
    });

    const programId = await this.deps.programReader.getCurrentProgramId();
    if (!programId) {
      throw new CatalogProgramNotFoundError();
    }

    const versions = await this.deps.versionReader.list(programId);
    const ids = versions.map((version) => version.id);
    const [objectiveCounts, attributeCounts] = await Promise.all([
      this.deps.objectiveReader.countByVersionIds(ids),
      this.deps.attributeReader.countByVersionIds(ids),
    ]);

    return listCatalogVersionsResponseSchema.parse({
      items: versions.map((version) =>
        mapCatalogVersionToDto(
          version,
          objectiveCounts.get(version.id) ?? 0,
          attributeCounts.get(version.id) ?? 0,
        ),
      ),
    });
  }
}
