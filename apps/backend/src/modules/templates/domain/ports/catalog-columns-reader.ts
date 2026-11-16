import type { CatalogColumns } from '../policies/catalog-columns.js';

/** Puerto de lectura de columnas dinámicas OE/AG desde el catálogo vigente. */
export interface CatalogColumnsReader {
  readCurrent(): Promise<CatalogColumns | null>;
}
