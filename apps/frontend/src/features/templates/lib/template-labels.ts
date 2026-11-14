import type { TemplateTypeValue } from '@sigoa/shared';

export const TEMPLATE_TYPE_LABELS: Record<TemplateTypeValue, string> = {
  ANNEX: 'Anexo',
  MINUTES: 'Acta',
  SURVEY: 'Encuesta',
  INSTRUMENT: 'Instrumento',
};

export const TEMPLATE_TYPE_OPTIONS: readonly TemplateTypeValue[] = [
  'ANNEX',
  'MINUTES',
  'SURVEY',
  'INSTRUMENT',
];

export function formatTemplateType(type: TemplateTypeValue): string {
  return TEMPLATE_TYPE_LABELS[type];
}

/** Etiqueta corta de una versión de plantilla (`v2`). */
export function formatVersionLabel(number: number): string {
  return `v${number}`;
}
