import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { Semester } from '../../domain/entities/semester.js';
import { SemesterCodeAlreadyExistsError, SemesterOverlapError } from '../../domain/errors/index.js';
import type { SemesterReader } from '../../domain/ports/semester-reader.js';
import type { SemesterRepository } from '../../domain/ports/semester-repository.js';
import {
  mapPrismaSemesterRowToDomain,
  parseIsoDayToDate,
  type PrismaSemesterRow,
} from './prisma-semester-mapper.js';

export class PrismaSemesterRepository implements SemesterRepository, SemesterReader {
  constructor(private readonly dbProvider: DbProvider) {}

  private mapToDomain(row: PrismaSemesterRow): Semester {
    return mapPrismaSemesterRowToDomain(row);
  }

  private handleDatabaseErrors(error: unknown): void {
    if (error && typeof error === 'object') {
      const err = error as { code?: string; message?: string };
      if (err.code === 'P2002') {
        throw new SemesterCodeAlreadyExistsError(
          'Ya existe un semestre con el código especificado.',
        );
      }
      // PostgreSQL 23P01 exclusion_violation
      if (
        err.code === '23P01' ||
        err.message?.includes('semesters_no_overlap') ||
        err.message?.includes('exclusion constraint')
      ) {
        throw new SemesterOverlapError(
          'El rango de fechas del semestre se superpone con un semestre existente.',
        );
      }
    }
  }

  async lockAndListAll(): Promise<Semester[]> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'lockAndListAll solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    const client = this.dbProvider.get();
    await client.$executeRawUnsafe('LOCK TABLE semesters IN SHARE ROW EXCLUSIVE MODE;');

    const rows = await client.semester.findMany({
      orderBy: { startDate: 'asc' },
    });

    return rows.map((r) => this.mapToDomain(r as PrismaSemesterRow));
  }

  async add(semester: Semester): Promise<void> {
    const client = this.dbProvider.get();

    try {
      await client.semester.create({
        data: {
          id: semester.id,
          code: semester.code,
          startDate: parseIsoDayToDate(semester.startDate),
          endDate: parseIsoDayToDate(semester.endDate),
          createdBy: semester.createdBy,
          updatedBy: semester.updatedBy,
          createdAt: semester.createdAt,
          updatedAt: semester.updatedAt,
        },
      });
    } catch (error) {
      this.handleDatabaseErrors(error);
      throw error;
    }
  }

  async list(): Promise<Semester[]> {
    const client = this.dbProvider.get();
    const rows = await client.semester.findMany({
      orderBy: { startDate: 'desc' },
    });

    return rows.map((r) => this.mapToDomain(r as PrismaSemesterRow));
  }
}
