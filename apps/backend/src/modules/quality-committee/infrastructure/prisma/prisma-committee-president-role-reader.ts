import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { PresidentRoleHolder } from '../../domain/policies/president-alert.js';
import type { CommitteePresidentRoleReader } from '../../domain/ports/committee-president-role-reader.js';

/** Código oficial del rol Presidente del Comité en el módulo `authorization` (R10). */
export const COMMITTEE_PRESIDENT_ROLE_CODE = 'COMMITTEE_PRESIDENT';

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

/** Lista los usuarios activos que poseen el rol activo de Presidente del Comité sin exponer correo ni DNI. */
export class PrismaCommitteePresidentRoleReader implements CommitteePresidentRoleReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async listActiveHolders(): Promise<readonly PresidentRoleHolder[]> {
    const rows = await this.dbProvider.get().userRole.findMany({
      where: {
        role: {
          code: COMMITTEE_PRESIDENT_ROLE_CODE,
          status: 'ACTIVE',
        },
        user: {
          status: 'ACTIVE',
        },
      },
      select: {
        user: {
          select: {
            id: true,
            names: true,
            firstSurname: true,
            secondSurname: true,
          },
        },
      },
    });

    return rows
      .map((row) => ({
        userId: row.user.id,
        fullName: formatUserFullName(row.user),
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  }
}
