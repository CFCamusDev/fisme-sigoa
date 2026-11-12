import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { EducationalObjective } from '../../domain/entities/educational-objective.js';
import type { EducationalObjectiveReader } from '../../domain/ports/educational-objective-reader.js';
import type { EducationalObjectiveRepository } from '../../domain/ports/educational-objective-repository.js';
import {
  mapPrismaEducationalObjectiveRowToDomain,
  type PrismaEducationalObjectiveRow,
} from './prisma-educational-objective-mapper.js';

export class PrismaEducationalObjectiveRepository
  implements EducationalObjectiveReader, EducationalObjectiveRepository
{
  constructor(private readonly dbProvider: DbProvider) {}

  async listByVersion(versionId: string): Promise<EducationalObjective[]> {
    const rows = await this.dbProvider.get().educationalObjective.findMany({
      where: { versionId },
      orderBy: { order: 'asc' },
    });
    return rows.map((row) =>
      mapPrismaEducationalObjectiveRowToDomain(row as PrismaEducationalObjectiveRow),
    );
  }

  async insertMany(versionId: string, items: readonly EducationalObjective[]): Promise<void> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'insertMany solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }
    if (items.length === 0) {
      return;
    }
    await this.dbProvider.get().educationalObjective.createMany({
      data: items.map((item) => ({
        id: item.id,
        versionId,
        code: item.code,
        statement: item.statement,
        order: item.order,
        createdBy: item.createdBy,
        updatedBy: item.updatedBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  }
}
