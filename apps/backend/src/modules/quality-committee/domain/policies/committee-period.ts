import { InvalidQualityCommitteeDataError } from '../errors/invalid-quality-committee-data-error.js';

export const COMMITTEE_PERIOD_YEAR_MIN = 2000;
export const COMMITTEE_PERIOD_YEAR_MAX = 2100;
export const COMMITTEE_TIME_ZONE = 'America/Lima';

export interface CommitteePeriod {
  readonly periodStart: string;
  readonly periodEnd: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const limaDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: COMMITTEE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function assertValidIsoDate(raw: string, label: string): string {
  const normalized = raw.trim();
  const match = ISO_DATE_PATTERN.exec(normalized);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new InvalidQualityCommitteeDataError(`La ${label} debe tener formato AAAA-MM-DD.`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (year < COMMITTEE_PERIOD_YEAR_MIN || year > COMMITTEE_PERIOD_YEAR_MAX) {
    throw new InvalidQualityCommitteeDataError(
      `El año de la ${label} debe estar entre ${COMMITTEE_PERIOD_YEAR_MIN} y ${COMMITTEE_PERIOD_YEAR_MAX}.`,
    );
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    throw new InvalidQualityCommitteeDataError(`La ${label} no corresponde a un día válido.`);
  }

  return normalized;
}

export function assertValidPeriod(periodStart: string, periodEnd: string): CommitteePeriod {
  const normalizedStart = assertValidIsoDate(periodStart, 'fecha de inicio del periodo');
  const normalizedEnd = assertValidIsoDate(periodEnd, 'fecha de fin del periodo');

  if (normalizedStart > normalizedEnd) {
    throw new InvalidQualityCommitteeDataError(
      'La fecha de inicio del periodo no puede ser posterior a la fecha de fin.',
    );
  }

  return {
    periodStart: normalizedStart,
    periodEnd: normalizedEnd,
  };
}

export function periodsOverlap(a: CommitteePeriod, b: CommitteePeriod): boolean {
  return a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd;
}

export function isInForce(period: CommitteePeriod, today: string): boolean {
  return period.periodStart <= today && today <= period.periodEnd;
}

export function todayInLima(now: Date = new Date()): string {
  const parts = limaDateFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('No se pudo determinar la fecha civil en America/Lima.');
  }

  return `${year}-${month}-${day}`;
}
