import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import {
  CatalogItemNotFoundError,
  CatalogOrderMismatchError,
  DuplicateCatalogCodeError,
} from '../../domain/errors/index.js';
import type { ReorderPlanEntry } from '../../domain/policies/catalog-item-rules.js';
import type { EducationalObjective } from '../../domain/entities/educational-objective.js';
import type { EducationalObjectiveReader } from '../../domain/ports/educational-objective-reader.js';
import type { EducationalObjectiveRepository } from '../../domain/ports/educational-objective-repository.js';
import {
  mapPrismaEducationalObjectiveRowToDomain,
  type PrismaEducationalObjectiveRow,
} from './prisma-educational-objective-mapper.js';

/** Desplazamiento temporal de la fase 1; mayor que el tope de elementos por versión. */
const ORDER_SHIFT = 1000;

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

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

  async findById(id: string): Promise<EducationalObjective | null> {
    const row = await this.dbProvider.get().educationalObjective.findUnique({ where: { id } });
    return row
      ? mapPrismaEducationalObjectiveRowToDomain(row as PrismaEducationalObjectiveRow)
      : null;
  }

  async countByVersionIds(versionIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>(versionIds.map((id) => [id, 0]));
    if (versionIds.length === 0) {
      return counts;
    }
    const rows = await this.dbProvider.get().educationalObjective.groupBy({
      by: ['versionId'],
      where: { versionId: { in: [...versionIds] } },
      _count: { _all: true },
    });
    for (const row of rows) {
      counts.set(row.versionId, row._count._all);
    }
    return counts;
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

  async insert(item: EducationalObjective): Promise<void> {
    try {
      await this.dbProvider.get().educationalObjective.create({
        data: {
          id: item.id,
          versionId: item.versionId,
          code: item.code,
          statement: item.statement,
          order: item.order,
          createdBy: item.createdBy,
          updatedBy: item.updatedBy,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateCatalogCodeError();
      }
      throw error;
    }
  }

  async update(item: EducationalObjective): Promise<void> {
    let affected: number;
    try {
      const result = await this.dbProvider.get().educationalObjective.updateMany({
        where: { id: item.id, versionId: item.versionId },
        data: {
          code: item.code,
          statement: item.statement,
          updatedBy: item.updatedBy,
          updatedAt: item.updatedAt,
        },
      });
      affected = result.count;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateCatalogCodeError();
      }
      throw error;
    }
    if (affected !== 1) {
      throw new CatalogItemNotFoundError();
    }
  }

  async updateOrders(
    versionId: string,
    changes: readonly ReorderPlanEntry[],
    actorId: string,
    now: Date,
  ): Promise<void> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'updateOrders solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }
    if (changes.length === 0) {
      return;
    }
    const db = this.dbProvider.get();
    // Fase 1: libera las posiciones para que la fase 2 no choque con el índice único.
    const shifted = await db.educationalObjective.updateMany({
      where: { versionId, id: { in: changes.map((change) => change.id) } },
      data: { order: { increment: ORDER_SHIFT } },
    });
    if (shifted.count !== changes.length) {
      throw new CatalogOrderMismatchError();
    }
    // Fase 2: valor definitivo de cada elemento.
    for (const change of changes) {
      const result = await db.educationalObjective.updateMany({
        where: { id: change.id, versionId },
        data: { order: change.order, updatedBy: actorId, updatedAt: now },
      });
      if (result.count !== 1) {
        throw new CatalogOrderMismatchError();
      }
    }
  }
}
