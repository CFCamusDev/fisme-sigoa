import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { Parameter } from '../../domain/entities/parameter.js';
import { ParameterConflictError } from '../../domain/errors/index.js';
import type { ParameterReader, ParameterVersion } from '../../domain/ports/parameter-reader.js';
import type { ParameterRepository } from '../../domain/ports/parameter-repository.js';
import {
  compareParameterVersions,
  mapPrismaParameterRowToVersion,
  type PrismaParameterRow,
} from './prisma-parameter-mapper.js';

const SEMESTER_SELECT = { select: { code: true, startDate: true } } as const;

export class PrismaParameterRepository implements ParameterRepository, ParameterReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async listVersions(): Promise<ParameterVersion[]> {
    return this.readAll();
  }

  async lockAndListVersions(): Promise<ParameterVersion[]> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'lockAndListVersions solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    await this.dbProvider
      .get()
      .$executeRawUnsafe('LOCK TABLE parameters IN SHARE ROW EXCLUSIVE MODE;');
    return this.readAll();
  }

  async save(parameter: Parameter): Promise<void> {
    const client = this.dbProvider.get();
    try {
      const existing = await client.parameter.findFirst({
        where: {
          key: parameter.key,
          effectiveFromSemesterId: parameter.effectiveFromSemesterId,
        },
        select: { id: true },
      });

      if (existing) {
        await client.parameter.update({
          where: { id: existing.id },
          data: { value: parameter.value, updatedBy: parameter.updatedBy },
        });
        return;
      }

      await client.parameter.create({
        data: {
          id: parameter.id,
          key: parameter.key,
          value: parameter.value,
          effectiveFromSemesterId: parameter.effectiveFromSemesterId,
          createdBy: parameter.createdBy,
          updatedBy: parameter.updatedBy,
          createdAt: parameter.createdAt,
          updatedAt: parameter.updatedAt,
        },
      });
    } catch (error) {
      if (error && typeof error === 'object' && (error as { code?: string }).code === 'P2002') {
        throw new ParameterConflictError();
      }
      throw error;
    }
  }

  private async readAll(): Promise<ParameterVersion[]> {
    const rows = await this.dbProvider.get().parameter.findMany({
      include: { effectiveFromSemester: SEMESTER_SELECT },
    });
    return rows
      .map((row) => mapPrismaParameterRowToVersion(row as PrismaParameterRow))
      .sort(compareParameterVersions);
  }
}
