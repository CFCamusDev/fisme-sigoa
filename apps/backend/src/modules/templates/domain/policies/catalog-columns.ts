import type { TemplateRenderData } from './template-renderer.js';

export interface CatalogObjectiveColumn {
  readonly code: string;
  readonly statement: string;
  readonly order: number;
}

export interface CatalogAttributeColumn {
  readonly code: string;
  readonly name: string;
  readonly statement: string;
  readonly order: number;
}

export interface CatalogColumns {
  readonly catalogVersionId: string;
  readonly catalogVersionNumber: number;
  readonly objectives: readonly CatalogObjectiveColumn[];
  readonly attributes: readonly CatalogAttributeColumn[];
}

export const EMPTY_CATALOG_RENDER_DATA: TemplateRenderData = {
  scalars: {},
  collections: {},
};

/** Construye las colecciones `objectives` y `attributes` ordenadas por `order`. */
export function buildCatalogColumnCollections(
  columns: CatalogColumns,
): TemplateRenderData['collections'] {
  const objectives = [...columns.objectives]
    .sort((left, right) => left.order - right.order)
    .map((objective) => ({
      code: objective.code,
      statement: objective.statement,
    }));

  const attributes = [...columns.attributes]
    .sort((left, right) => left.order - right.order)
    .map((attribute) => ({
      code: attribute.code,
      name: attribute.name,
      statement: attribute.statement,
    }));

  return {
    objectives,
    attributes,
  };
}

/** Fusiona las columnas del catálogo sobre `base`, reemplazando `objectives` y `attributes`. */
export function mergeCatalogColumns(
  base: TemplateRenderData,
  columns: CatalogColumns,
): TemplateRenderData {
  return {
    scalars: base.scalars,
    collections: {
      ...base.collections,
      ...buildCatalogColumnCollections(columns),
    },
  };
}
