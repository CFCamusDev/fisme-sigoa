import { catalogComparisonDtoSchema, type CatalogComparisonDto } from '@sigoa/shared';
import { CatalogVersionNotFoundError, InvalidCatalogDataError } from '../domain/errors/index.js';
import {
  compareCatalogItems,
  summarizeCatalogComparison,
} from '../domain/policies/catalog-comparison.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionHistoryReader } from '../domain/ports/catalog-version-history-reader.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { buildVersionHistoryDto } from './catalog-version-history-dto.js';
import { mapCatalogVersionToDto } from './catalog-version-dto.js';

export interface CompareCatalogVersionsDependencies {
  readonly versionReader: CatalogVersionReader;
  readonly objectiveReader: EducationalObjectiveReader;
  readonly attributeReader: GraduateAttributeReader;
  readonly historyReader: CatalogVersionHistoryReader;
  readonly permissionChecker: CatalogPermissionChecker;
}

export interface CompareCatalogVersionsQuery {
  readonly actorId: string;
  readonly baseId: string;
  readonly targetId: string;
}

/**
 * Compara dos versiones del mismo programa (HU-017, RF-017): diferencias por código con
 * resaltado por palabras, más la resolución y vigencia de cada una. Es una lectura: sin
 * transacción ni auditoría (D3). No expone datos de quien creó o editó.
 */
export class CompareCatalogVersionsUseCase {
  constructor(private readonly deps: CompareCatalogVersionsDependencies) {}

  async execute(query: CompareCatalogVersionsQuery): Promise<CatalogComparisonDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'catalogo.ver',
      scope: 'GLOBAL',
    });

    if (query.baseId === query.targetId) {
      throw new InvalidCatalogDataError('Elige dos versiones distintas para compararlas.');
    }

    const [base, target] = await Promise.all([
      this.deps.versionReader.findById(query.baseId),
      this.deps.versionReader.findById(query.targetId),
    ]);
    if (!base || !target) {
      throw new CatalogVersionNotFoundError();
    }
    if (base.programId !== target.programId) {
      throw new InvalidCatalogDataError('Las versiones deben pertenecer al mismo programa.');
    }

    const [baseObjectives, baseAttributes, targetObjectives, targetAttributes, versions, history] =
      await Promise.all([
        this.deps.objectiveReader.listByVersion(base.id),
        this.deps.attributeReader.listByVersion(base.id),
        this.deps.objectiveReader.listByVersion(target.id),
        this.deps.attributeReader.listByVersion(target.id),
        this.deps.versionReader.list(base.programId),
        this.deps.historyReader.listForProgram(base.programId),
      ]);

    const objectives = compareCatalogItems(baseObjectives, targetObjectives);
    const attributes = compareCatalogItems(baseAttributes, targetAttributes);

    return catalogComparisonDtoSchema.parse({
      base: {
        version: mapCatalogVersionToDto(base, baseObjectives.length, baseAttributes.length),
        history: buildVersionHistoryDto(base.id, versions, history),
      },
      target: {
        version: mapCatalogVersionToDto(target, targetObjectives.length, targetAttributes.length),
        history: buildVersionHistoryDto(target.id, versions, history),
      },
      summary: summarizeCatalogComparison(objectives, attributes),
      objectives,
      attributes,
    });
  }
}
