import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { Program } from '../../domain/entities/program.js';
import { ProgramCodeAlreadyExistsError, ProgramNotFoundError } from '../../domain/errors/index.js';
import type { ProgramReader } from '../../domain/ports/program-reader.js';
import type { ProgramRepository } from '../../domain/ports/program-repository.js';
import { mapPrismaProgramRowToDomain, type PrismaProgramRow } from './prisma-program-mapper.js';

export class PrismaProgramRepository implements ProgramRepository, ProgramReader {
  constructor(private readonly dbProvider: DbProvider) {}

  private mapToDomain(row: PrismaProgramRow): Program {
    return mapPrismaProgramRowToDomain(row);
  }

  private handleUniqueConstraintError(error: unknown): void {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new ProgramCodeAlreadyExistsError('Ya existe un programa con el código especificado.');
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

  async findCurrentForUpdate(): Promise<Program | null> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'findCurrentForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    const client = this.dbProvider.get();
    const rows = await client.$queryRaw<PrismaProgramRow[]>`
      SELECT
        id,
        code,
        name,
        faculty,
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt"
      FROM programs
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async getCurrent(): Promise<Program | null> {
    const client = this.dbProvider.get();
    const row = await client.program.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    return row ? this.mapToDomain(row as PrismaProgramRow) : null;
  }

  async save(program: Program): Promise<void> {
    const client = this.dbProvider.get();

    try {
      await client.program.update({
        where: { id: program.id },
        data: {
          code: program.code,
          name: program.name,
          faculty: program.faculty,
          updatedBy: program.updatedBy,
        },
      });
    } catch (error) {
      this.handleUniqueConstraintError(error);
      if (this.isRecordNotFoundError(error)) {
        throw new ProgramNotFoundError(`Programa con ID "${program.id}" no encontrado.`);
      }
      throw error;
    }
  }

  async add(program: Program): Promise<void> {
    const client = this.dbProvider.get();

    try {
      await client.program.create({
        data: {
          id: program.id,
          code: program.code,
          name: program.name,
          faculty: program.faculty,
          createdBy: program.createdBy,
          updatedBy: program.updatedBy,
          createdAt: program.createdAt,
          updatedAt: program.updatedAt,
        },
      });
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }
}
