import type { PrismaClient } from '../../../../shared/prisma/generated/client.js';
import type {
  BootstrapAdminRepository,
  NewAdministratorData,
} from '../../domain/ports/bootstrap-admin-repository.js';

const ADMINISTRATOR_ROLE_CODE = 'ADMINISTRATOR';

/** Recibe el cliente de la transacción del seed (`tx`). */
export class PrismaBootstrapAdminRepository implements BootstrapAdminRepository {
  constructor(private readonly db: PrismaClient) {}

  async existsAdministrator(): Promise<boolean> {
    const count = await this.db.userRole.count({
      where: { role: { code: ADMINISTRATOR_ROLE_CODE } },
    });
    return count > 0;
  }

  async findUserByEmailOrDni(email: string, dni: string): Promise<'EMAIL' | 'DNI' | null> {
    const users = await this.db.user.findMany({
      where: { OR: [{ email }, { dni }] },
      select: { email: true },
    });
    if (users.length === 0) {
      return null;
    }
    return users.some((user) => user.email === email) ? 'EMAIL' : 'DNI';
  }

  async createAdministrator(data: NewAdministratorData): Promise<string> {
    const role = await this.db.role.findUnique({
      where: { code: ADMINISTRATOR_ROLE_CODE },
      select: { id: true },
    });
    if (!role) {
      throw new Error(
        `El rol ${ADMINISTRATOR_ROLE_CODE} no existe; el seed de autorización debe ejecutarse antes.`,
      );
    }

    const user = await this.db.user.create({
      data: {
        email: data.email,
        names: data.names,
        firstSurname: data.firstSurname,
        secondSurname: data.secondSurname,
        dni: data.dni,
        passwordHash: data.passwordHash,
        status: 'ACTIVE',
        createdBy: 'SEED',
        updatedBy: 'SEED',
        userRoles: {
          create: { roleId: role.id, createdBy: 'SEED', updatedBy: 'SEED' },
        },
      },
      select: { id: true },
    });
    return user.id;
  }
}
