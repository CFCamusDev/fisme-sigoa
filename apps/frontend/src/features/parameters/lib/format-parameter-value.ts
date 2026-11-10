import { PARAMETER_DEFINITIONS, type ParameterKey } from '@sigoa/shared';

const numberFormatter = new Intl.NumberFormat('es-PE');

/** Escala del puntaje de logro (UMBRAL_LOGRADO): 0 a 20. */
const SCORE_MAX = 20;

/**
 * Formatea el valor de un parámetro con su unidad: `70 %`, `14 / 20`, `5 intentos`, `7 días`.
 * Usa `Intl` con es-PE (AGENTS §4.3).
 */
export function formatParameterValue(key: ParameterKey, value: number): string {
  const formatted = numberFormatter.format(value);
  const { unit } = PARAMETER_DEFINITIONS[key];

  switch (unit) {
    case 'PERCENT':
      return `${formatted} %`;
    case 'SCORE':
      return `${formatted} / ${SCORE_MAX}`;
    case 'DAYS':
      return `${formatted} ${value === 1 ? 'día' : 'días'}`;
    case 'COUNT':
      if (key === 'LOGIN_INTENTOS') {
        return `${formatted} ${value === 1 ? 'intento' : 'intentos'}`;
      }
      return `${formatted} ${value === 1 ? 'participante' : 'participantes'}`;
  }
}

/** Texto de la columna «Vigente desde»: «Valor por defecto» cuando no hay semestre. */
export function formatEffectiveFrom(semesterCode: string | null): string {
  return semesterCode ?? 'Valor por defecto';
}
