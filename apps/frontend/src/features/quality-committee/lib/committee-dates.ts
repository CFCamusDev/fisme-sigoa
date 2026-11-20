const COMMITTEE_TIME_ZONE = 'America/Lima';

const displayDateFormatter = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const limaIsoFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: COMMITTEE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatCommitteeDate(isoDate: string): string {
  const [yearPart, monthPart, dayPart] = isoDate.split('-');
  if (!yearPart || !monthPart || !dayPart) {
    return isoDate;
  }

  const utcDate = new Date(
    Date.UTC(
      Number.parseInt(yearPart, 10),
      Number.parseInt(monthPart, 10) - 1,
      Number.parseInt(dayPart, 10),
    ),
  );
  if (Number.isNaN(utcDate.getTime())) {
    return isoDate;
  }

  return displayDateFormatter.format(utcDate);
}

export function formatCommitteePeriod(periodStart: string, periodEnd: string): string {
  return `${formatCommitteeDate(periodStart)} – ${formatCommitteeDate(periodEnd)}`;
}

export function todayInLima(now: Date = new Date()): string {
  const parts = limaIsoFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return now.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

/** Oculta el botón de edición si el periodo ya finalizó en hora de Lima; el servidor valida con 409. */
export function isCommitteeEditable(periodEnd: string, now: Date = new Date()): boolean {
  return periodEnd >= todayInLima(now);
}
