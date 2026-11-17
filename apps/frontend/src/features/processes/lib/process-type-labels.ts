import type { ProcessTypeValue } from '@sigoa/shared';

export const PROCESS_TYPE_LABELS: Record<ProcessTypeValue, string> = {
  P611: '6.1.1 Establecer y validar OE',
  P612: '6.1.2 Medir OE (anual)',
  P613: '6.1.3 Revisar OE (cada 3 años)',
  P621: '6.2.1 Establecer AG',
  P622: '6.2.2 Medición directa de AG (semestral)',
  P623: '6.2.3 Medición indirecta de AG (anual)',
};

export const PROCESS_DEFAULT_NAME_PREFIXES: Record<ProcessTypeValue, string> = {
  P611: 'Establecimiento y validación de OE',
  P612: 'Medición anual de OE',
  P613: 'Revisión trienal de OE',
  P621: 'Establecimiento y validación de AG',
  P622: 'Medición directa de AG',
  P623: 'Medición indirecta anual de AG',
};

export function getSuggestedExecutionName(
  type: ProcessTypeValue,
  year: number,
  semesterCode?: string | null,
): string {
  const prefix = PROCESS_DEFAULT_NAME_PREFIXES[type];
  const periodLabel = type === 'P622' && semesterCode ? semesterCode : String(year);
  return `${prefix} ${periodLabel}`;
}
