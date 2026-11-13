import type { GraduateAttribute } from '../entities/graduate-attribute.js';

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
}
