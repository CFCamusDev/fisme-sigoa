import type { CatalogAttributeDto, CatalogObjectiveDto } from '@sigoa/shared';
import type { CatalogItemKind } from '../api/reorder-catalog-items';

export type CatalogEditorItem = CatalogObjectiveDto | CatalogAttributeDto;

export interface CatalogKindLabels {
  /** Título de la sección. */
  readonly title: string;
  /** Sustantivo singular en minúsculas ("objetivo educacional"). */
  readonly singular: string;
  /** Texto del botón de alta. */
  readonly addLabel: string;
}

export const CATALOG_KIND_LABELS: Record<CatalogItemKind, CatalogKindLabels> = {
  OBJECTIVES: {
    title: 'Objetivos educacionales',
    singular: 'objetivo educacional',
    addLabel: 'Agregar objetivo',
  },
  ATTRIBUTES: {
    title: 'Atributos del graduado',
    singular: 'atributo del graduado',
    addLabel: 'Agregar atributo',
  },
};

export function hasName(item: CatalogEditorItem): item is CatalogAttributeDto {
  return 'name' in item;
}
