import type { Semester } from '../entities/semester.js';
import { SemesterCodeAlreadyExistsError, SemesterOverlapError } from '../errors/index.js';

export function assertSemesterFitsSchedule(
  candidate: Semester,
  existing: readonly Semester[],
): void {
  for (const item of existing) {
    if (item.id === candidate.id) {
      continue;
    }

    if (item.code === candidate.code) {
      throw new SemesterCodeAlreadyExistsError(
        `Ya existe un semestre con el código ${candidate.code}.`,
      );
    }

    // Rangos de fechas cerrados [inicio, fin]
    // Se superponen si candidate.startDate <= item.endDate && candidate.endDate >= item.startDate
    const isOverlapping =
      candidate.startDate <= item.endDate && candidate.endDate >= item.startDate;

    if (isOverlapping) {
      throw new SemesterOverlapError(
        `El rango de fechas del semestre se superpone con el semestre ${item.code} (${item.startDate} a ${item.endDate}).`,
      );
    }
  }
}
