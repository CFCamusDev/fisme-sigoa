export const PROCESS_TYPES = ['P611', 'P612', 'P613', 'P621', 'P622', 'P623'] as const;

export type ProcessType = (typeof PROCESS_TYPES)[number];

export type ProcessFamily = 'VALIDATION' | 'MEASUREMENT';
export type ProcessPeriodKind = 'YEAR' | 'SEMESTER';

export interface ProcessTypeRule {
  readonly family: ProcessFamily;
  readonly periodKind: ProcessPeriodKind;
  readonly defaultNamePrefix: string;
}

export const PROCESS_TYPE_RULES: Record<ProcessType, ProcessTypeRule> = {
  P611: {
    family: 'VALIDATION',
    periodKind: 'YEAR',
    defaultNamePrefix: 'Establecimiento y validación de OE',
  },
  P612: {
    family: 'MEASUREMENT',
    periodKind: 'YEAR',
    defaultNamePrefix: 'Medición anual de OE',
  },
  P613: {
    family: 'VALIDATION',
    periodKind: 'YEAR',
    defaultNamePrefix: 'Revisión trienal de OE',
  },
  P621: {
    family: 'VALIDATION',
    periodKind: 'YEAR',
    defaultNamePrefix: 'Establecimiento y validación de AG',
  },
  P622: {
    family: 'MEASUREMENT',
    periodKind: 'SEMESTER',
    defaultNamePrefix: 'Medición directa de AG',
  },
  P623: {
    family: 'MEASUREMENT',
    periodKind: 'YEAR',
    defaultNamePrefix: 'Medición indirecta anual de AG',
  },
};

export function buildDefaultProcessExecutionName(
  type: ProcessType,
  year: number,
  semesterCode?: string | null,
): string {
  const rule = PROCESS_TYPE_RULES[type];
  const periodLabel = rule.periodKind === 'SEMESTER' && semesterCode ? semesterCode : String(year);
  return `${rule.defaultNamePrefix} ${periodLabel}`;
}
