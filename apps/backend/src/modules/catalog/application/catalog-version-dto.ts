import { catalogVersionDtoSchema, type CatalogVersionDto } from '@sigoa/shared';
import type { CatalogVersion } from '../domain/entities/catalog-version.js';

/** DTO de una versión con sus conteos; nunca se devuelve la entidad (AGENTS §4.2). */
export function mapCatalogVersionToDto(
  version: CatalogVersion,
  objectiveCount: number,
  attributeCount: number,
): CatalogVersionDto {
  return {
    id: version.id,
    programId: version.programId,
    number: version.number,
    status: version.status,
    basedOnVersionId: version.basedOnVersionId,
    objectiveCount,
    attributeCount,
    createdAt: version.createdAt.toISOString(),
  };
}

/** Mapea y valida el DTO contra el contrato; se llama antes de confirmar la transacción. */
export function buildCatalogVersionDto(
  version: CatalogVersion,
  objectiveCount: number,
  attributeCount: number,
): CatalogVersionDto {
  return catalogVersionDtoSchema.parse(
    mapCatalogVersionToDto(version, objectiveCount, attributeCount),
  );
}
