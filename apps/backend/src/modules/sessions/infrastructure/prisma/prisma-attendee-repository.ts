import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { Attendee } from '../../domain/entities/attendee.js';
import { InvalidSessionDataError } from '../../domain/errors/invalid-session-data-error.js';
import type {
  AttendeeRepository,
  ReplaceSessionAttendeesInput,
} from '../../domain/ports/attendee-repository.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

export class PrismaAttendeeRepository implements AttendeeRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async listBySession(sessionId: string): Promise<readonly Attendee[]> {
    const rows = await this.dbProvider.get().attendee.findMany({
      where: { sessionId },
      orderBy: { listMemberId: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      listMemberId: row.listMemberId,
      position: row.position,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    }));
  }

  async replaceForSession(input: ReplaceSessionAttendeesInput): Promise<readonly Attendee[]> {
    const db = this.dbProvider.get();

    await db.attendee.deleteMany({
      where: { sessionId: input.sessionId },
    });

    if (input.entries.length === 0) {
      return [];
    }

    try {
      await db.attendee.createMany({
        data: input.entries.map((entry) => ({
          sessionId: input.sessionId,
          listMemberId: entry.listMemberId,
          position: entry.position,
          createdBy: input.actorId,
          createdAt: input.now,
        })),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new InvalidSessionDataError(
          'No se pueden registrar asistentes repetidos en la sesión.',
        );
      }
      throw error;
    }

    return this.listBySession(input.sessionId);
  }

  async countBySession(sessionId: string): Promise<number> {
    return this.dbProvider.get().attendee.count({
      where: { sessionId },
    });
  }
}
