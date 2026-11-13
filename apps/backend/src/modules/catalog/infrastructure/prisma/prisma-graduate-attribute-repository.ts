import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { CatalogItemNotFoundError, DuplicateCatalogCodeError } from '../../domain/errors/index.js';
import type { GraduateAttribute } from '../../domain/entities/graduate-attribute.js';
import type { GraduateAttributeReader } from '../../domain/ports/graduate-attribute-reader.js';
import type { GraduateAttributeRepository } from '../../domain/ports/graduate-attribute-repository.js';
import {
  mapPrismaGraduateAttributeRowToDomain,
  type PrismaGraduateAttributeRow,
} from './prisma-graduate-attribute-mapper.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

export class PrismaGraduateAttributeRepository
  implements GraduateAttributeReader, GraduateAttributeRepository
{
  constructor(private readonly dbProvider: DbProvider) {}

  async listByVersion(versionId: string): Promise<GraduateAttribute[]> {
    const rows = await this.dbProvider.get().graduateAttribute.findMany({
      where: { versionId },
      orderBy: { order: 'asc' },
    });
    return rows.map((row) =>
      mapPrismaGraduateAttributeRowToDomain(row as PrismaGraduateAttributeRow),
    );
  }

  async findById(id: string): Promise<GraduateAttribute | null> {
    const row = await this.dbProvider.get().graduateAttribute.findUnique({ where: { id } });
    return row ? mapPrismaGraduateAttributeRowToDomain(row as PrismaGraduateAttributeRow) : null;
  }

  async countByVersionIds(versionIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>(versionIds.map((id) => [id, 0]));
    if (versionIds.length === 0) {
      return counts;
    }
    const rows = await this.dbProvider.get().graduateAttribute.groupBy({
      by: ['versionId'],
      where: { versionId: { in: [...versionIds] } },
      _count: { _all: true },
    });
    for (const row of rows) {
      counts.set(row.versionId, row._count._all);
    }
    return counts;
  }

  async insertMany(versionId: string, items: readonly GraduateAttribute[]): Promise<void> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'insertMany solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }
    if (items.length === 0) {
      return;
    }
    await this.dbProvider.get().graduateAttribute.createMany({
      data: items.map((item) => ({
        id: item.id,
        versionId,
        code: item.code,
        name: item.name,
        statement: item.statement,
        order: item.order,
        createdBy: item.createdBy,
        updatedBy: item.updatedBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  }

  async insert(item: GraduateAttribute): Promise<void> {
    try {
      await this.dbProvider.get().graduateAttribute.create({
        data: {
          id: item.id,
          versionId: item.versionId,
          code: item.code,
          name: item.name,
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

  async update(item: GraduateAttribute): Promise<void> {
    let affected: number;
    try {
      const result = await this.dbProvider.get().graduateAttribute.updateMany({
        where: { id: item.id, versionId: item.versionId },
        data: {
          code: item.code,
          name: item.name,
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
}
