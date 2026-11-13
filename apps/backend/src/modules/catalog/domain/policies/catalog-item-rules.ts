import { CATALOG_MAX_ITEMS } from '../entities/catalog-limits.js';
import type { CatalogVersionStatus } from '../entities/catalog-version.js';
import {
  CatalogItemLimitReachedError,
  CatalogOrderMismatchError,
  CatalogVersionNotEditableError,
  DuplicateCatalogCodeError,
} from '../errors/index.js';

/** Forma mínima común a OE y AG para aplicar las reglas de edición. */
export interface CatalogItemRef {
  readonly id: string;
  readonly code: string;
  readonly order: number;
}

/** Solo la versión en Borrador admite cambios (RS-020, RS 5.3). */
export function assertVersionEditable(status: CatalogVersionStatus): void {
  if (status !== 'DRAFT') {
    throw new CatalogVersionNotEditableError();
  }
}

/** El código es único dentro de la versión; `excludeId` deja editar el propio ítem (RF-014). */
export function assertCodeAvailable(
  code: string,
  items: readonly CatalogItemRef[],
  excludeId?: string,
): void {
  if (items.some((item) => item.code === code && item.id !== excludeId)) {
    throw new DuplicateCatalogCodeError();
  }
}

/** Acota el crecimiento de la lista (D7). */
export function assertCanAddItem(currentCount: number): void {
  if (currentCount >= CATALOG_MAX_ITEMS) {
    throw new CatalogItemLimitReachedError();
  }
}

export interface ReorderPlanEntry {
  readonly id: string;
  readonly order: number;
}

/**
 * Valida que la lista de ids sea exactamente el conjunto actual (sin faltantes, sobrantes ni
 * repetidos) y devuelve los órdenes 1…n sin huecos.
 */
export function planReorder(
  items: readonly CatalogItemRef[],
  orderedIds: readonly string[],
): ReorderPlanEntry[] {
  const currentIds = new Set(items.map((item) => item.id));
  const requestedIds = new Set(orderedIds);
  const sameSet =
    orderedIds.length === items.length &&
    requestedIds.size === orderedIds.length &&
    [...requestedIds].every((id) => currentIds.has(id));
  if (!sameSet) {
    throw new CatalogOrderMismatchError();
  }
  return orderedIds.map((id, index) => ({ id, order: index + 1 }));
}
