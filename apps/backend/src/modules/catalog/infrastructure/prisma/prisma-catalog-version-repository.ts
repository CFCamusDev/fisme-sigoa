import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  CatalogVersion,
  CatalogVersionStatus,
} from '../../domain/entities/catalog-version.js';
import {
  CatalogVersionNumberConflictError,
  OpenCatalogVersionExistsError,
} from '../../domain/errors/index.js';
import type { CatalogVersionReader } from '../../domain/ports/catalog-version-reader.js';
import type { CatalogVersionRepository } from '../../domain/ports/catalog-version-repository.js';
import {
  mapPrismaCatalogVersionRowToDomain,
  type PrismaCatalogVersionRow,
} from './prisma-catalog-version-mapper.js';

const OPEN_STATUSES = ['DRAFT', 'IN_VALIDATION'] as const;

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

/** Texto de la violación (meta y mensaje) para distinguir qué índice único se rompió: el de `(programId, number)` nombra `number`; el de abiertas, no. */
function violationText(error: unknown): string {
  const { meta, message } = error as { meta?: unknown; message?: string };
  return `${JSON.stringify(meta ?? {})} ${message ?? ''}`;
}

export class PrismaCatalogVersionRepository
  implements CatalogVersionReader, CatalogVersionRepository
{
  constructor(private readonly dbProvider: DbProvider) {}

  async list(programId: string): Promise<CatalogVersion[]> {
    const rows = await this.dbProvider.get().catalogVersion.findMany({
      where: { programId },
      orderBy: { number: 'desc' },
    });
    return rows.map((row) => mapPrismaCatalogVersionRowToDomain(row as PrismaCatalogVersionRow));
  }

  async findById(id: string): Promise<CatalogVersion | null> {
    const row = await this.dbProvider.get().catalogVersion.findUnique({ where: { id } });
    return row ? mapPrismaCatalogVersionRowToDomain(row as PrismaCatalogVersionRow) : null;
  }

  async findCurrent(programId: string): Promise<CatalogVersion | null> {
    const row = await this.dbProvider
      .get()
      .catalogVersion.findFirst({ where: { programId, status: 'APPROVED' } });
    return row ? mapPrismaCatalogVersionRowToDomain(row as PrismaCatalogVersionRow) : null;
  }

  async findOpen(programId: string): Promise<CatalogVersion | null> {
    const row = await this.dbProvider
      .get()
      .catalogVersion.findFirst({ where: { programId, status: { in: [...OPEN_STATUSES] } } });
    return row ? mapPrismaCatalogVersionRowToDomain(row as PrismaCatalogVersionRow) : null;
  }

  async maxNumber(programId: string): Promise<number> {
    const result = await this.dbProvider
      .get()
      .catalogVersion.aggregate({ where: { programId }, _max: { number: true } });
    return result._max.number ?? 0;
  }

  async lockProgram(programId: string): Promise<void> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'lockProgram solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }
    await this.dbProvider
      .get()
      .$queryRawUnsafe('SELECT "id" FROM "programs" WHERE "id" = $1 FOR UPDATE', programId);
  }

  async lockForEdit(versionId: string): Promise<CatalogVersion | null> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'lockForEdit solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }
    await this.dbProvider
      .get()
      .$queryRawUnsafe('SELECT "id" FROM "catalog_versions" WHERE "id" = $1 FOR UPDATE', versionId);
    // Se lee después del bloqueo para ver el estado confirmado por la última transacción.
    return await this.findById(versionId);
  }

  async transitionStatus(
    versionId: string,
    from: CatalogVersionStatus,
    to: CatalogVersionStatus,
    actorId: string,
    now: Date,
  ): Promise<boolean> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'transitionStatus solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }
    const result = await this.dbProvider.get().catalogVersion.updateMany({
      where: { id: versionId, status: from },
      data: { status: to, updatedBy: actorId, updatedAt: now },
    });
    return result.count === 1;
  }

  async save(version: CatalogVersion): Promise<void> {
    try {
      await this.dbProvider.get().catalogVersion.create({
        data: {
          id: version.id,
          programId: version.programId,
          number: version.number,
          status: version.status,
          basedOnVersionId: version.basedOnVersionId,
          createdBy: version.createdBy,
          updatedBy: version.updatedBy,
          createdAt: version.createdAt,
          updatedAt: version.updatedAt,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const text = violationText(error);
        if (text.includes('number')) {
          throw new CatalogVersionNumberConflictError();
        }
        throw new OpenCatalogVersionExistsError();
      }
      throw error;
    }
  }
}
