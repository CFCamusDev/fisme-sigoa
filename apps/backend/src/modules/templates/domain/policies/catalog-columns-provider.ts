import { CatalogColumnsUnavailableError } from '../errors/catalog-columns-unavailable-error.js';
import type { CatalogColumnsReader } from '../ports/catalog-columns-reader.js';
import {
  EMPTY_CATALOG_RENDER_DATA,
  mergeCatalogColumns,
  type CatalogColumns,
} from './catalog-columns.js';
import type { TemplateRenderData } from './template-renderer.js';

export interface CatalogColumnsProviderDependencies {
  readonly reader: CatalogColumnsReader;
}

/** Provee columnas OE y AG desde el catálogo vigente para renderizar plantillas. */
export class CatalogColumnsProvider {
  constructor(private readonly deps: CatalogColumnsProviderDependencies) {}

  async getColumns(): Promise<CatalogColumns> {
    const columns = await this.deps.reader.readCurrent();
    if (!columns) {
      throw new CatalogColumnsUnavailableError();
    }
    return columns;
  }

  async getRenderData(
    base: TemplateRenderData = EMPTY_CATALOG_RENDER_DATA,
  ): Promise<TemplateRenderData> {
    const columns = await this.getColumns();
    return mergeCatalogColumns(base, columns);
  }
}
