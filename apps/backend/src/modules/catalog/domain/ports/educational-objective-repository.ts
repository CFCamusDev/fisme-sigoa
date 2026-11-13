import type { EducationalObjective } from '../entities/educational-objective.js';

export interface EducationalObjectiveRepository {
  /**
   * Exige transacción activa (evita versiones con copia a medias). Inserta todos los objetivos
   * de la versión o ninguno.
   */
  insertMany(versionId: string, items: readonly EducationalObjective[]): Promise<void>;
  /** Inserta un objetivo nuevo. Lanza `DuplicateCatalogCodeError` si el código ya existe en la versión. */
  insert(item: EducationalObjective): Promise<void>;
  /**
   * Actualiza código, enunciado y auditoría de campos del objetivo, filtrando por `id` **y**
   * `versionId`. Lanza `CatalogItemNotFoundError` si no afecta ninguna fila y
   * `DuplicateCatalogCodeError` si el código choca con otro de la versión.
   */
  update(item: EducationalObjective): Promise<void>;
}
