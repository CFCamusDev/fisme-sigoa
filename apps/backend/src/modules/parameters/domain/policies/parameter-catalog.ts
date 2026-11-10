import { InvalidParameterDataError } from '../errors/invalid-parameter-data-error.js';

export type ParameterUnit = 'SCORE' | 'PERCENT' | 'COUNT' | 'DAYS';

export interface ParameterDefinition {
  readonly key: string;
  readonly unit: ParameterUnit;
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
}

/**
 * Catálogo cerrado de parámetros (RF-011, LN sección 13). El dominio repite estas constantes
 * porque no importa @sigoa/shared; una prueba de paridad en T-011-08 compara ambos catálogos.
 */
export const PARAMETER_CATALOG = {
  UMBRAL_LOGRADO: {
    key: 'UMBRAL_LOGRADO',
    unit: 'SCORE',
    min: 0,
    max: 20,
    defaultValue: 14,
  },
  META_AG: { key: 'META_AG', unit: 'PERCENT', min: 0, max: 100, defaultValue: 70 },
  PESO_DIRECTA: { key: 'PESO_DIRECTA', unit: 'PERCENT', min: 0, max: 100, defaultValue: 70 },
  PESO_INDIRECTA: { key: 'PESO_INDIRECTA', unit: 'PERCENT', min: 0, max: 100, defaultValue: 30 },
  MIN_PARTICIPACION: {
    key: 'MIN_PARTICIPACION',
    unit: 'COUNT',
    min: 1,
    max: 1000,
    defaultValue: 3,
  },
  TOKEN_DIAS: { key: 'TOKEN_DIAS', unit: 'DAYS', min: 1, max: 365, defaultValue: 7 },
  LOGIN_INTENTOS: { key: 'LOGIN_INTENTOS', unit: 'COUNT', min: 1, max: 20, defaultValue: 5 },
} as const satisfies Record<string, ParameterDefinition>;

export type ParameterKey = keyof typeof PARAMETER_CATALOG;

export const PARAMETER_KEYS = Object.keys(PARAMETER_CATALOG) as ParameterKey[];

export const WEIGHT_KEYS = ['PESO_DIRECTA', 'PESO_INDIRECTA'] as const satisfies ParameterKey[];

export const WEIGHTS_TOTAL = 100;

export function isParameterKey(value: unknown): value is ParameterKey {
  return typeof value === 'string' && Object.hasOwn(PARAMETER_CATALOG, value);
}

export function getParameterDefinition(key: ParameterKey): ParameterDefinition {
  return PARAMETER_CATALOG[key];
}

export function assertParameterKey(key: unknown): asserts key is ParameterKey {
  if (!isParameterKey(key)) {
    throw new InvalidParameterDataError(
      `La clave de parámetro "${String(key)}" no pertenece al catálogo.`,
    );
  }
}

export function assertParameterValueInRange(key: ParameterKey, value: unknown): void {
  const definition = PARAMETER_CATALOG[key];
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < definition.min ||
    value > definition.max
  ) {
    throw new InvalidParameterDataError(
      `El valor de ${key} debe ser un número entero entre ${definition.min} y ${definition.max}.`,
    );
  }
}
