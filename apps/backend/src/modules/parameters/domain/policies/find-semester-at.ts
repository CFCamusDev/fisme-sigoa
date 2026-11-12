import type { Semester } from '../entities/semester.js';

/**
 * Semestre vigente en un día (`YYYY-MM-DD`): el último iniciado hasta esa fecha, aunque ya haya
 * terminado. Nulo si ninguno ha iniciado.
 */
export function findSemesterAt(semesters: readonly Semester[], isoDay: string): Semester | null {
  let latest: Semester | null = null;
  for (const semester of semesters) {
    if (
      semester.startDate <= isoDay &&
      (latest === null || semester.startDate > latest.startDate)
    ) {
      latest = semester;
    }
  }
  return latest;
}
