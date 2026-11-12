import {
  PARAMETER_DEFINITIONS,
  type ParameterDto,
  type ParametersResponse,
  type ParameterVersionDto,
} from '@sigoa/shared';
import type { Semester } from '../domain/entities/semester.js';
import { PARAMETER_KEYS } from '../domain/policies/parameter-catalog.js';
import { pickEffectiveVersion } from '../domain/policies/pick-effective-version.js';
import type { ParameterVersion } from '../domain/ports/parameter-reader.js';

export interface BuildParametersViewInput {
  readonly versions: readonly ParameterVersion[];
  readonly semesters: readonly Semester[];
  /** Semestre consultado; nulo = solo rigen los valores por defecto. */
  readonly semester: Semester | null;
}

/**
 * Arma la vista vigente de un semestre con el historial de versiones por clave. Compartido por
 * `DefineParameters` y `ListEffectiveParameters`. La vigencia «hasta» se deriva: es el semestre
 * anterior al inicio de la versión siguiente (nulo si no tiene fin o si no hay semestre previo).
 */
export function buildParametersView(input: BuildParametersViewInput): ParametersResponse {
  const orderedSemesters = [...input.semesters].sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
  );

  const previousSemesterCode = (startDate: string): string | null => {
    let previous: string | null = null;
    for (const semester of orderedSemesters) {
      if (semester.startDate < startDate) {
        previous = semester.code;
      }
    }
    return previous;
  };

  const items: ParameterDto[] = PARAMETER_KEYS.map((key) => {
    const ofKey = input.versions
      .filter((version) => version.parameter.key === key)
      .sort((a, b) => {
        if (a.semesterStartDate === b.semesterStartDate) return 0;
        if (a.semesterStartDate === null) return -1;
        if (b.semesterStartDate === null) return 1;
        return a.semesterStartDate < b.semesterStartDate ? -1 : 1;
      });

    const versions: ParameterVersionDto[] = ofKey.map((version, index) => {
      const next = ofKey[index + 1];
      return {
        value: version.parameter.value,
        effectiveFromSemesterCode: version.semesterCode,
        effectiveToSemesterCode:
          next && next.semesterStartDate !== null
            ? previousSemesterCode(next.semesterStartDate)
            : null,
      };
    });

    const effective = pickEffectiveVersion(ofKey, input.semester?.startDate ?? null);
    const definition = PARAMETER_DEFINITIONS[key];
    return {
      key,
      label: definition.label,
      unit: definition.unit,
      value: effective?.parameter.value ?? definition.defaultValue,
      effectiveFromSemesterCode: effective?.semesterCode ?? null,
      versions,
    };
  });

  return { semesterCode: input.semester?.code ?? null, items };
}
