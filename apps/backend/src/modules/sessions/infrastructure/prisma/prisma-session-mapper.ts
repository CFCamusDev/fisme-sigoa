import type { Session as PrismaSessionRow } from '../../../../shared/prisma/generated/client.js';
import { Session } from '../../domain/entities/session.js';
import type { SessionModality } from '../../domain/entities/session-modality.js';
import type { SessionStakeholderType } from '../../domain/entities/session-stakeholder-type.js';

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

export function mapPrismaSessionRowToDomain(
  row: PrismaSessionRow,
  executionIds: readonly string[],
): Session {
  return Session.rehydrate({
    id: row.id,
    stakeholderType: row.stakeholderType as SessionStakeholderType,
    stakeholderListId: row.stakeholderListId,
    sessionDate: formatUtcDateToIso(row.sessionDate),
    startTime: row.startTime,
    modality: row.modality as SessionModality,
    meetingUrl: row.meetingUrl,
    recordingUrl: row.recordingUrl,
    executionIds,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
