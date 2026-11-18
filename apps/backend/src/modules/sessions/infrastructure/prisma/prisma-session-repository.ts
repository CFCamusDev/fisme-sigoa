import type { Session as PrismaSessionRow } from '../../../../shared/prisma/generated/client.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { Session } from '../../domain/entities/session.js';
import { DuplicateSessionError } from '../../domain/errors/duplicate-session-error.js';
import type { SessionRepository } from '../../domain/ports/session-repository.js';
import { mapPrismaSessionRowToDomain, parseIsoDateToUtc } from './prisma-session-mapper.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async save(session: Session): Promise<void> {
    try {
      await this.dbProvider.get().session.create({
        data: {
          id: session.id,
          stakeholderType: session.stakeholderType,
          stakeholderListId: session.stakeholderListId,
          sessionDate: parseIsoDateToUtc(session.sessionDate),
          startTime: session.startTime,
          modality: session.modality,
          meetingUrl: session.meetingUrl,
          recordingUrl: session.recordingUrl,
          createdBy: session.createdBy,
          updatedBy: session.updatedBy,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateSessionError(
          session.stakeholderType,
          session.sessionDate,
          session.startTime,
        );
      }
      throw error;
    }
  }

  async update(session: Session): Promise<void> {
    try {
      await this.dbProvider.get().session.update({
        where: { id: session.id },
        data: {
          stakeholderType: session.stakeholderType,
          stakeholderListId: session.stakeholderListId,
          sessionDate: parseIsoDateToUtc(session.sessionDate),
          startTime: session.startTime,
          modality: session.modality,
          meetingUrl: session.meetingUrl,
          recordingUrl: session.recordingUrl,
          updatedBy: session.updatedBy,
          updatedAt: session.updatedAt,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateSessionError(
          session.stakeholderType,
          session.sessionDate,
          session.startTime,
        );
      }
      throw error;
    }
  }

  async findByIdForUpdate(id: string): Promise<Session | null> {
    const db = this.dbProvider.get();
    const rows = await db.$queryRaw<PrismaSessionRow[]>`
      SELECT
        "id",
        "stakeholderType",
        "stakeholderListId",
        "sessionDate",
        "startTime",
        "modality",
        "meetingUrl",
        "recordingUrl",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt"
      FROM "sessions"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    if (!row) {
      return null;
    }

    const links = await db.sessionExecution.findMany({
      where: { sessionId: id },
      select: { processExecutionId: true },
      orderBy: { processExecutionId: 'asc' },
    });

    return mapPrismaSessionRowToDomain(
      row,
      links.map((link) => link.processExecutionId),
    );
  }
}
