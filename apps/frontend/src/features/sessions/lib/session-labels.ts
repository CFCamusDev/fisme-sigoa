import type { SessionModalityValue } from '@sigoa/shared';

export const SESSION_MODALITY_LABELS: Record<SessionModalityValue, string> = {
  VIRTUAL: 'Virtual',
  IN_PERSON: 'Presencial',
  HYBRID: 'Híbrida',
};

const DATE_FORMATTER = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatSessionDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) {
    return isoDate;
  }
  const year = Number.parseInt(parts[0] ?? '', 10);
  const month = Number.parseInt(parts[1] ?? '', 10);
  const day = Number.parseInt(parts[2] ?? '', 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return isoDate;
  }
  return DATE_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)));
}
