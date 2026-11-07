import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { UserAccessSubjectRepository } from '../../domain/ports/user-access-subject-repository.js';

export class PrismaUserAccessSubjectRepository implements UserAccessSubjectRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async lockForUpdate(
    userId: string,
  ): Promise<{ id: string; status: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION' } | null> {
    if (!(this.dbProvider.isInTransaction?.() ?? false)) {
      throw new Error(
        'lockForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }
    const rows = await this.dbProvider.get().$queryRaw<
      Array<{ id: string; status: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION' }>
    >`
      SELECT id, status FROM users WHERE id = ${userId} FOR UPDATE
    `;
    return rows[0] ?? null;
  }
}
