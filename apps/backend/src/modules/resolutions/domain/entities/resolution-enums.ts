export const RESOLUTION_TYPES = [
  'EDUCATIONAL_OBJECTIVE',
  'GRADUATE_ATTRIBUTE',
  'IMPROVEMENT_PLAN',
] as const;
export type ResolutionType = (typeof RESOLUTION_TYPES)[number];

export const RESOLUTION_STATUSES = ['REGISTERED', 'APPROVED'] as const;
export type ResolutionStatus = (typeof RESOLUTION_STATUSES)[number];

/** Tipos que se pueden registrar hoy: el Plan de Mejora aún no existe (D6). */
export const REGISTERABLE_RESOLUTION_TYPES: readonly ResolutionType[] = [
  'EDUCATIONAL_OBJECTIVE',
  'GRADUATE_ATTRIBUTE',
];

export const RESOLUTION_NUMBER_MAX_LENGTH = 40;
/** Letras, dígitos, guion, barra, punto y espacio (p. ej. `RD-012/2027-FISME`). */
export const RESOLUTION_NUMBER_PATTERN = /^[A-Za-z0-9\-/. ]+$/;
