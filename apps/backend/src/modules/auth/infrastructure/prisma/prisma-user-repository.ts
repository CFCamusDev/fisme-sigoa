import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { User, type UserStatus } from '../../domain/entities/user.js';
import type { UserRepository } from '../../domain/ports/user-repository.js';
import { NotFoundError } from '../../../../shared/errors/app-error.js';
import { UserNotPendingActivationError } from '../../domain/errors/user-not-pending-activation-error.js';

interface PrismaUserRow {
  id: string;
  names: string;
  firstSurname: string;
  secondSurname: string | null;
  email: string;
  dni: string | null;
  passwordHash: string | null;
  status: UserStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private mapToDomain(row: PrismaUserRow): User {
    return User.restore({
      id: row.id,
      names: row.names,
      firstSurname: row.firstSurname,
      secondSurname: row.secondSurname,
      email: row.email,
      dni: row.dni,
      passwordHash: row.passwordHash,
      status: row.status,
      failedLoginAttempts: row.failedLoginAttempts,
      lockedUntil: row.lockedUntil,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
    });
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

    return row ? this.mapToDomain(row) : null;
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
        "passwordHash",
        status,
        "failedLoginAttempts",
        "lockedUntil",
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

  async findByEmail(email: string): Promise<User | null> {
    const client = this.dbProvider.get();
    const normalized = this.normalizeEmail(email);

    const row = await client.user.findUnique({
      where: { email: normalized },
    });

    return row ? this.mapToDomain(row) : null;
  }

  async findByEmailForUpdate(email: string): Promise<User | null> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'findByEmailForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    const client = this.dbProvider.get();
    const normalized = this.normalizeEmail(email);

    const rows = await client.$queryRaw<PrismaUserRow[]>`
      SELECT
        id,
        names,
        "firstSurname",
        "secondSurname",
        email,
        dni,
        "passwordHash",
        status,
        "failedLoginAttempts",
        "lockedUntil",
        "lastLoginAt",
        "createdAt",
        "updatedAt",
        "createdBy",
        "updatedBy"
      FROM users
      WHERE email = ${normalized}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    const client = this.dbProvider.get();

    try {
      await client.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil,
          lastLoginAt: user.lastLoginAt,
        },
      });
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        throw new NotFoundError(`Usuario con ID "${user.id}" no encontrado.`);
      }
      throw error;
    }
  }

  async saveActivation(user: User): Promise<void> {
    const client = this.dbProvider.get();

    const result = await client.user.updateMany({
      where: {
        id: user.id,
        status: 'PENDING_ACTIVATION',
      },
      data: {
        status: user.status,
        passwordHash: user.passwordHash,
        updatedAt: user.updatedAt ?? new Date(),
        updatedBy: user.updatedBy ?? null,
      },
    });

    if (result.count === 0) {
      throw new UserNotPendingActivationError();
    }
  }
}
