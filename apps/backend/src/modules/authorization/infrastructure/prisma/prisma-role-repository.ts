import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { Role } from '../../domain/entities/role.js';
import { RoleAlreadyExistsError } from '../../domain/errors/role-already-exists-error.js';
import type { RoleRepository } from '../../domain/ports/role-repository.js';
import { mapPrismaRoleRowToDomain, type PrismaRoleRow } from './prisma-role-mapper.js';

export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  private mapToDomain(row: PrismaRoleRow): Role {
    return mapPrismaRoleRowToDomain(row);
  }

  private handleUniqueConstraintError(error: unknown): void {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new RoleAlreadyExistsError();
    }
  }

  async findById(id: string): Promise<Role | null> {
    const client = this.dbProvider.get();
    const row = await client.role.findUnique({
      where: { id },
    });

    return row ? this.mapToDomain(row as PrismaRoleRow) : null;
  }

  async findByIdForUpdate(id: string): Promise<Role | null> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'findByIdForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    const client = this.dbProvider.get();
    const rows = await client.$queryRaw<PrismaRoleRow[]>`
      SELECT
        id,
        code,
        name,
        description,
        status,
        "deactivatedAt",
        "isPredefined",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt"
      FROM roles
      WHERE id = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async findByCode(code: string): Promise<Role | null> {
    const client = this.dbProvider.get();
    const row = await client.role.findUnique({
      where: { code },
    });

    return row ? this.mapToDomain(row as PrismaRoleRow) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const client = this.dbProvider.get();
    const trimmed = name.trim();

    const row = await client.role.findFirst({
      where: {
        name: {
          equals: trimmed,
          mode: 'insensitive',
        },
      },
    });

    return row ? this.mapToDomain(row as PrismaRoleRow) : null;
  }

  async add(role: Role): Promise<void> {
    const client = this.dbProvider.get();

    try {
      await client.role.create({
        data: {
          id: role.id,
          code: role.code,
          name: role.name,
          description: role.description,
          status: role.status,
          deactivatedAt: role.deactivatedAt,
          isPredefined: role.isPredefined,
          createdBy: role.createdBy,
          updatedBy: role.updatedBy,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        },
      });
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }
}
