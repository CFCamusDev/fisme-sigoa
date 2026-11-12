import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { ResponseScale, ScaleType } from '../../domain/entities/response-scale.js';
import { ResponseScaleCodeAlreadyExistsError } from '../../domain/errors/index.js';
import type { ResponseScaleReader } from '../../domain/ports/response-scale-reader.js';
import type { ResponseScaleRepository } from '../../domain/ports/response-scale-repository.js';
import {
  mapPrismaResponseScaleRowToDomain,
  type PrismaResponseScaleRow,
} from './prisma-response-scale-mapper.js';

const WITH_LEVELS = { levels: { orderBy: { order: 'asc' } } } as const;

export class PrismaResponseScaleRepository implements ResponseScaleReader, ResponseScaleRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async list(filter?: { type?: ScaleType }): Promise<ResponseScale[]> {
    const rows = await this.dbProvider.get().responseScale.findMany({
      where: filter?.type ? { type: filter.type } : undefined,
      include: WITH_LEVELS,
      orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
    });
    return rows.map((row) => mapPrismaResponseScaleRowToDomain(row as PrismaResponseScaleRow));
  }

  async findById(id: string): Promise<ResponseScale | null> {
    const row = await this.dbProvider
      .get()
      .responseScale.findUnique({ where: { id }, include: WITH_LEVELS });
    return row ? mapPrismaResponseScaleRowToDomain(row as PrismaResponseScaleRow) : null;
  }

  async findByCode(code: string): Promise<ResponseScale | null> {
    const row = await this.dbProvider
      .get()
      .responseScale.findUnique({ where: { code }, include: WITH_LEVELS });
    return row ? mapPrismaResponseScaleRowToDomain(row as PrismaResponseScaleRow) : null;
  }

  async lockById(id: string): Promise<ResponseScale | null> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'lockById solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    const locked = await this.dbProvider
      .get()
      .$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "response_scales" WHERE "id" = $1 FOR UPDATE',
        id,
      );
    if (locked.length === 0) {
      return null;
    }
    return this.findById(id);
  }

  async save(scale: ResponseScale): Promise<void> {
    const client = this.dbProvider.get();
    try {
      const existing = await client.responseScale.findUnique({
        where: { id: scale.id },
        select: { id: true },
      });

      if (existing) {
        await client.responseScale.update({
          where: { id: scale.id },
          data: { name: scale.name, updatedBy: scale.updatedBy },
        });
        return;
      }

      await client.responseScale.create({
        data: {
          id: scale.id,
          code: scale.code,
          name: scale.name,
          type: scale.type,
          createdBy: scale.createdBy,
          updatedBy: scale.updatedBy,
          createdAt: scale.createdAt,
          updatedAt: scale.updatedAt,
        },
      });
    } catch (error) {
      if (error && typeof error === 'object' && (error as { code?: string }).code === 'P2002') {
        throw new ResponseScaleCodeAlreadyExistsError();
      }
      throw error;
    }
  }
}
