import type { QualityCommittee as PrismaQualityCommitteeRow } from '../../../../shared/prisma/generated/client.js';
import type { QualityCommittee } from '../../domain/entities/quality-committee.js';

export function formatUtcDateToIso(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDateToUtc(isoDate: string): Date {
  const [yearPart, monthPart, dayPart] = isoDate.split('-');
  return new Date(
    Date.UTC(
      Number.parseInt(yearPart ?? '0', 10),
      Number.parseInt(monthPart ?? '1', 10) - 1,
      Number.parseInt(dayPart ?? '1', 10),
    ),
  );
}

export function mapPrismaQualityCommitteeRowToDomain(
  row: PrismaQualityCommitteeRow,
): QualityCommittee {
  return {
    id: row.id,
    programId: row.programId,
    periodStart: formatUtcDateToIso(row.periodStart),
    periodEnd: formatUtcDateToIso(row.periodEnd),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
