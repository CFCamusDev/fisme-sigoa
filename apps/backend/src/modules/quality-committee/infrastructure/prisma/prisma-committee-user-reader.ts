import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  CommitteeUserReader,
  CommitteeUserRef,
  CommitteeUserStatus,
} from '../../domain/ports/committee-user-reader.js';

function formatUserFullName(row: {
  names: string;
  firstSurname: string;
  secondSurname: string | null;
}): string {
  return [row.names, row.firstSurname, row.secondSurname]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())
    .join(' ');
}

/** Lee referencias mínimas de usuarios (`id`, nombre completo y estado) sin exponer correo ni DNI. */
export class PrismaCommitteeUserReader implements CommitteeUserReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async findByIds(ids: readonly string[]): Promise<readonly CommitteeUserRef[]> {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const rows = await this.dbProvider.get().user.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        names: true,
        firstSurname: true,
        secondSurname: true,
        status: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      fullName: formatUserFullName(row),
      status: row.status as CommitteeUserStatus,
    }));
  }

  async findByEmails(emails: readonly string[]): Promise<ReadonlyMap<string, CommitteeUserRef>> {
    const uniqueEmails = [
      ...new Set(emails.map((email) => email.trim().toLowerCase()).filter((e) => e.length > 0)),
    ];
    if (uniqueEmails.length === 0) {
      return new Map();
    }

    const rows = await this.dbProvider.get().user.findMany({
      where: {
        OR: uniqueEmails.map((email) => ({
          email: { equals: email, mode: 'insensitive' },
        })),
      },
      select: {
        id: true,
        email: true,
        names: true,
        firstSurname: true,
        secondSurname: true,
        status: true,
      },
    });

    const result = new Map<string, CommitteeUserRef>();
    for (const row of rows) {
      result.set(row.email.toLowerCase(), {
        id: row.id,
        fullName: formatUserFullName(row),
        status: row.status as CommitteeUserStatus,
      });
    }

    return result;
  }
}
