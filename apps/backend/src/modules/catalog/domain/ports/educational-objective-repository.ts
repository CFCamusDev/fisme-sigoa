import type { EducationalObjective } from '../entities/educational-objective.js';

export interface EducationalObjectiveRepository {
  /**
   * Exige transacción activa (evita versiones con copia a medias). Inserta todos los objetivos
   * de la versión o ninguno.
   */
  insertMany(versionId: string, items: readonly EducationalObjective[]): Promise<void>;
}
