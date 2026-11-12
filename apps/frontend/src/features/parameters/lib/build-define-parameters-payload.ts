import {
  PARAMETER_KEYS,
  type DefineParametersRequest,
  type ParameterDto,
  type ParameterKey,
} from '@sigoa/shared';

const WEIGHT_KEYS: readonly ParameterKey[] = ['PESO_DIRECTA', 'PESO_INDIRECTA'];

/** Valores del formulario: texto tal como lo escribió la persona (puede estar vacío). */
export type ParameterFormValues = Record<ParameterKey, string>;

/** Convierte la vista vigente de un semestre en los valores iniciales del formulario. */
export function toFormValues(items: readonly ParameterDto[]): ParameterFormValues {
  const values = {} as ParameterFormValues;
  for (const key of PARAMETER_KEYS) {
    const item = items.find((candidate) => candidate.key === key);
    values[key] = item ? String(item.value) : '';
  }
  return values;
}

/** Texto → número entero; vacío o no numérico devuelve `NaN` (lo rechaza el esquema Zod). */
function toNumber(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

/**
 * Arma la carga de `POST /parameters` con lo que cambió respecto de los valores vigentes del
 * semestre (D18): solo las claves modificadas y, si cambia un peso, siempre ambos (D4).
 * Devuelve `null` si no hay cambios.
 */
export function buildDefineParametersPayload(input: {
  semesterCode: string;
  current: readonly ParameterDto[];
  values: ParameterFormValues;
}): DefineParametersRequest | null {
  const changed = new Set<ParameterKey>();
  for (const key of PARAMETER_KEYS) {
    const currentItem = input.current.find((candidate) => candidate.key === key);
    if (!currentItem || toNumber(input.values[key]) !== currentItem.value) {
      changed.add(key);
    }
  }

  if (WEIGHT_KEYS.some((key) => changed.has(key))) {
    for (const key of WEIGHT_KEYS) {
      changed.add(key);
    }
  }

  if (changed.size === 0) {
    return null;
  }

  return {
    semesterCode: input.semesterCode,
    values: PARAMETER_KEYS.filter((key) => changed.has(key)).map((key) => ({
      key,
      value: toNumber(input.values[key]),
    })),
  };
}
