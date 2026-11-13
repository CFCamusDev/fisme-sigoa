import {
  catalogAttributesResponseSchema,
  catalogObjectivesResponseSchema,
  type CatalogAttributeDto,
  type CatalogAttributesResponse,
  type CatalogObjectiveDto,
  type CatalogObjectivesResponse,
} from '@sigoa/shared';
import type { EducationalObjective } from '../domain/entities/educational-objective.js';
import type { GraduateAttribute } from '../domain/entities/graduate-attribute.js';

/** DTO de un OE; no expone `createdBy`/`updatedBy` (datos personales). */
export function mapObjectiveToDto(item: EducationalObjective): CatalogObjectiveDto {
  return {
    id: item.id,
    code: item.code,
    statement: item.statement,
    order: item.order,
    updatedAt: item.updatedAt.toISOString(),
  };
}

/** DTO de un AG; no expone `createdBy`/`updatedBy` (datos personales). */
export function mapAttributeToDto(item: GraduateAttribute): CatalogAttributeDto {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    statement: item.statement,
    order: item.order,
    updatedAt: item.updatedAt.toISOString(),
  };
}

/** Lista completa y ordenada de OE, validada contra el contrato antes de confirmar. */
export function buildObjectivesResponse(
  items: readonly EducationalObjective[],
): CatalogObjectivesResponse {
  return catalogObjectivesResponseSchema.parse({ items: items.map(mapObjectiveToDto) });
}

/** Lista completa y ordenada de AG, validada contra el contrato antes de confirmar. */
export function buildAttributesResponse(
  items: readonly GraduateAttribute[],
): CatalogAttributesResponse {
  return catalogAttributesResponseSchema.parse({ items: items.map(mapAttributeToDto) });
}
