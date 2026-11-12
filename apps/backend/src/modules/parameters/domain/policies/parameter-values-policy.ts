import { InvalidParameterDataError } from '../errors/invalid-parameter-data-error.js';
import {
  WEIGHTS_TOTAL,
  WEIGHT_KEYS,
  assertParameterKey,
  assertParameterValueInRange,
  type ParameterKey,
} from './parameter-catalog.js';

export interface ParameterValueInput {
  readonly key: string;
  readonly value: number;
}

/**
 * Valida un cambio de parámetros: no vacío, claves del catálogo sin repetir, valores enteros
 * dentro de su rango y pesos en par que suman 100 (RF-011, CA3).
 */
export function assertValidParameterChange(values: readonly ParameterValueInput[]): void {
  if (values.length === 0) {
    throw new InvalidParameterDataError('Debe indicar al menos un parámetro.');
  }

  const seen = new Map<ParameterKey, number>();
  for (const item of values) {
    assertParameterKey(item.key);
    if (seen.has(item.key)) {
      throw new InvalidParameterDataError(`La clave ${item.key} está repetida.`);
    }
    assertParameterValueInRange(item.key, item.value);
    seen.set(item.key, item.value);
  }

  const [directKey, indirectKey] = WEIGHT_KEYS;
  const direct = seen.get(directKey);
  const indirect = seen.get(indirectKey);
  if (direct === undefined && indirect === undefined) {
    return;
  }
  if (direct === undefined || indirect === undefined) {
    throw new InvalidParameterDataError(
      'Los pesos de medición directa e indirecta se definen juntos y deben sumar 100.',
    );
  }
  if (direct + indirect !== WEIGHTS_TOTAL) {
    throw new InvalidParameterDataError(
      `Los pesos de medición directa e indirecta deben sumar ${WEIGHTS_TOTAL}.`,
    );
  }
}
