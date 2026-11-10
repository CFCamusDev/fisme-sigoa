import { PARAMETER_DEFINITIONS, PARAMETER_KEYS, type ParametersResponse } from '@sigoa/shared';

/** Vista con los siete valores por defecto (CA1); `overrides` reemplaza campos de una clave. */
export function buildParametersResponse(
  semesterCode: string | null = '2027-I',
  overrides: Partial<
    Record<
      (typeof PARAMETER_KEYS)[number],
      { value: number; from: string; versions: ParametersResponse['items'][number]['versions'] }
    >
  > = {},
): ParametersResponse {
  return {
    semesterCode,
    items: PARAMETER_KEYS.map((key) => {
      const definition = PARAMETER_DEFINITIONS[key];
      const override = overrides[key];
      return {
        key,
        label: definition.label,
        unit: definition.unit,
        value: override?.value ?? definition.defaultValue,
        effectiveFromSemesterCode: override?.from ?? null,
        versions: override?.versions ?? [
          {
            value: definition.defaultValue,
            effectiveFromSemesterCode: null,
            effectiveToSemesterCode: null,
          },
        ],
      };
    }),
  };
}

/** UMBRAL_LOGRADO pasa de 14 a 15 desde 2027-I (CA2). */
export function buildParametersResponseWithNewVersion(): ParametersResponse {
  return buildParametersResponse('2027-I', {
    UMBRAL_LOGRADO: {
      value: 15,
      from: '2027-I',
      versions: [
        { value: 14, effectiveFromSemesterCode: null, effectiveToSemesterCode: '2026-II' },
        { value: 15, effectiveFromSemesterCode: '2027-I', effectiveToSemesterCode: null },
      ],
    },
  });
}
