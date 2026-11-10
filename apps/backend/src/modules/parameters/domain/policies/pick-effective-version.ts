import type { ParameterVersion } from '../ports/parameter-reader.js';

/**
 * Elige la versión que rige para un semestre: la de mayor fecha de inicio menor o igual a la del
 * semestre consultado; la versión por defecto (sin semestre) es la más antigua. Con
 * `semesterStartDate` nulo solo rigen los valores por defecto. Fechas como `YYYY-MM-DD`.
 */
export function pickEffectiveVersion(
  versions: readonly ParameterVersion[],
  semesterStartDate: string | null,
): ParameterVersion | undefined {
  let selected: ParameterVersion | undefined;
  for (const candidate of versions) {
    const start = candidate.semesterStartDate;
    if (start === null) {
      selected ??= candidate;
      continue;
    }
    if (semesterStartDate === null || start > semesterStartDate) {
      continue;
    }
    if (
      selected === undefined ||
      selected.semesterStartDate === null ||
      start > selected.semesterStartDate
    ) {
      selected = candidate;
    }
  }
  return selected;
}
