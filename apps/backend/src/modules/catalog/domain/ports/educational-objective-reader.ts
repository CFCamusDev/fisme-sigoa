import type { EducationalObjective } from '../entities/educational-objective.js';

export interface EducationalObjectiveReader {
  /** Objetivos de la versión, ordenados por `order`. */
  listByVersion(versionId: string): Promise<EducationalObjective[]>;
}
