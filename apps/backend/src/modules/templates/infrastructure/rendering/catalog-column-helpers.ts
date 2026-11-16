import {
  EMPTY_CATALOG_RENDER_DATA,
  mergeCatalogColumns,
  type CatalogColumns,
} from '../../domain/policies/catalog-columns.js';
import {
  renderTemplateHtml,
  type TemplateRenderData,
} from '../../domain/policies/template-renderer.js';

const CATALOG_COLUMN_KEYS = [
  'objectives.code',
  'objectives.statement',
  'attributes.code',
  'attributes.name',
  'attributes.statement',
] as const;

/** Renderiza una plantilla HTML inyectando las columnas OE y AG del catálogo vigente. */
export function renderTemplateWithCatalogColumns(
  content: string,
  columns: CatalogColumns,
  base: TemplateRenderData = EMPTY_CATALOG_RENDER_DATA,
): string {
  return renderTemplateHtml(content, mergeCatalogColumns(base, columns));
}

/** Claves de plantilla que aporta el catálogo vigente para iterar OE y AG. */
export function catalogColumnKeys(): readonly string[] {
  return CATALOG_COLUMN_KEYS;
}
