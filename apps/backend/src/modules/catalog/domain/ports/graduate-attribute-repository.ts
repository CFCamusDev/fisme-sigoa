import type { GraduateAttribute } from '../entities/graduate-attribute.js';
import type { ReorderPlanEntry } from '../policies/catalog-item-rules.js';

export interface GraduateAttributeRepository {
  /**
   * Exige transacción activa (evita versiones con copia a medias). Inserta todos los atributos
   * de la versión o ninguno.
   */
  insertMany(versionId: string, items: readonly GraduateAttribute[]): Promise<void>;
  /** Inserta un atributo nuevo. Lanza `DuplicateCatalogCodeError` si el código ya existe en la versión. */
  insert(item: GraduateAttribute): Promise<void>;
  /**
   * Actualiza código, nombre y enunciado del atributo, filtrando por `id` **y** `versionId`.
   * Lanza `CatalogItemNotFoundError` si no afecta ninguna fila y `DuplicateCatalogCodeError` si
   * el código choca con otro de la versión.
   */
  update(item: GraduateAttribute): Promise<void>;
  /**
   * Exige transacción activa. Fija el orden de los elementos indicados (solo los que cambian) en
   * dos fases —los desplaza `+1000` y luego les da el valor definitivo— para no chocar con el
   * índice único `(versionId, order)`. Lanza `CatalogOrderMismatchError` si alguna fila no
   * pertenece a la versión.
   */
  updateOrders(
    versionId: string,
    changes: readonly ReorderPlanEntry[],
    actorId: string,
    now: Date,
  ): Promise<void>;
}
