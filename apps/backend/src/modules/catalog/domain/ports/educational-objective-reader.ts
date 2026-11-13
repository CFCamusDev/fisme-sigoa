import type { EducationalObjective } from '../entities/educational-objective.js';

export interface EducationalObjectiveReader {
  /** Objetivos de la versión, ordenados por `order`. */
  listByVersion(versionId: string): Promise<EducationalObjective[]>;
  /** Un objetivo por id, o `null` si no existe. */
  findById(id: string): Promise<EducationalObjective | null>;
  /** Cantidad de objetivos por versión en una sola consulta; las versiones sin filas valen 0. */
  countByVersionIds(versionIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
