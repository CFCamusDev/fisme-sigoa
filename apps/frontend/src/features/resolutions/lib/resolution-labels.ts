import type { ResolutionTypeValue } from '@sigoa/shared';

export const RESOLUTION_TYPE_LABELS: Record<ResolutionTypeValue, string> = {
  EDUCATIONAL_OBJECTIVE: 'Objetivos educacionales',
  GRADUATE_ATTRIBUTE: 'Atributos del graduado',
  IMPROVEMENT_PLAN: 'Plan de mejora',
};

/** Tipos que se pueden registrar hoy: el plan de mejora aún no está disponible (D6 del tramo 1). */
export const REGISTERABLE_RESOLUTION_TYPES: readonly ResolutionTypeValue[] = [
  'EDUCATIONAL_OBJECTIVE',
  'GRADUATE_ATTRIBUTE',
];

export function formatResolutionType(type: ResolutionTypeValue): string {
  return RESOLUTION_TYPE_LABELS[type];
}

/** Etiqueta corta de una versión del catálogo (`V2`). */
export function formatVersionLabel(number: number): string {
  return `V${number}`;
}
