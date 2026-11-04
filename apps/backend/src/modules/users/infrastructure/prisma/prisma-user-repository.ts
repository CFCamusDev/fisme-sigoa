import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { User } from '../../domain/entities/user.js';
import {
  UserDniAlreadyExistsError,
  UserEmailAlreadyExistsError,
  UserNotFoundError,
} from '../../domain/errors/index.js';
import type { UserRepository } from '../../domain/ports/user-repository.js';
import { mapPrismaUserRowToDomain, type PrismaUserRow } from './prisma-user-mapper.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  private mapToDomain(row: PrismaUserRow): User {
    return mapPrismaUserRowToDomain(row);
  }

  private handleUniqueConstraintError(error: unknown): void {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const meta = (error as { meta?: { target?: string[] | string } }).meta;
      const target = meta?.target;
      const message = (error as { message?: string }).message ?? '';

      const isEmail =
        (Array.isArray(target) && target.includes('email')) ||
        (typeof target === 'string' && target.toLowerCase().includes('email')) ||
        message.toLowerCase().includes('email') ||
        message.includes('users_email_key');

      const isDni =
        (Array.isArray(target) && target.includes('dni')) ||
        (typeof target === 'string' && target.toLowerCase().includes('dni')) ||
        message.toLowerCase().includes('dni') ||
        message.includes('users_dni_key');

      if (isEmail) {
        throw new UserEmailAlreadyExistsError();
      }
      if (isDni) {
        throw new UserDniAlreadyExistsError();
      }
      throw new UserEmailAlreadyExistsError();
    }
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025',
    );
  }

  async findById(id: string): Promise<User | null> {
    const client = this.dbProvider.get();
    const row = await client.user.findUnique({
      where: { id },
    });

    return row ? this.mapToDomain(row as PrismaUserRow) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const client = this.dbProvider.get();
    const normalized = email.trim().toLowerCase();

    const row = await client.user.findUnique({
      where: { email: normalized },
    });

    return row ? this.mapToDomain(row as PrismaUserRow) : null;
  }

  async findByDni(dni: string): Promise<User | null> {
    const client = this.dbProvider.get();
    const trimmed = dni.trim();

    const row = await client.user.findUnique({
      where: { dni: trimmed },
    });

    return row ? this.mapToDomain(row as PrismaUserRow) : null;
  }

  async findByIdForUpdate(id: string): Promise<User | null> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'findByIdForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    const client = this.dbProvider.get();
    const rows = await client.$queryRaw<PrismaUserRow[]>`
      SELECT
        id,
        names,
        "firstSurname",
        "secondSurname",
        email,
        dni,
        status,
        "lastLoginAt",
        "createdAt",
        "updatedAt",
        "createdBy",
        "updatedBy"
      FROM users
      WHERE id = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async add(user: User): Promise<void> {
    const client = this.dbProvider.get();

    try {
      await client.user.create({
        data: {
          id: user.id,
          names: user.names,
          firstSurname: user.firstSurname,
          secondSurname: user.secondSurname,
          email: user.email,
          dni: user.dni,
          status: user.status,
          createdBy: user.createdBy,
          updatedBy: user.updatedBy,
        },
      });
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async save(user: User): Promise<void> {
    const client = this.dbProvider.get();

    try {
      await client.user.update({
        where: { id: user.id },
        data: {
          names: user.names,
          firstSurname: user.firstSurname,
          secondSurname: user.secondSurname,
          email: user.email,
          dni: user.dni,
          status: user.status,
          updatedBy: user.updatedBy,
        },
      });
    } catch (error) {
      this.handleUniqueConstraintError(error);
      if (this.isRecordNotFoundError(error)) {
        throw new UserNotFoundError(`Usuario con ID "${user.id}" no encontrado.`);
      }
      throw error;
    }
  }
}
