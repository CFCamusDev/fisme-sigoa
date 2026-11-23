import { ConflictError } from '../../../../shared/errors/app-error.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { Resolution, ResolutionPdf } from '../../domain/entities/resolution.js';
import {
  CatalogVersionResolutionExistsError,
  DuplicateResolutionNumberError,
} from '../../domain/errors/index.js';
import type {
  ListResolutionsFilter,
  ResolutionPage,
  ResolutionReader,
} from '../../domain/ports/resolution-reader.js';
import type { ResolutionRepository } from '../../domain/ports/resolution-repository.js';
import { mapPrismaResolutionRowToDomain } from './prisma-resolution-mapper.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

function classifyUniqueViolation(error: unknown): ConflictError {
  const { meta, message } = error as { meta?: unknown; message?: string };
  const text = `${JSON.stringify(meta ?? {})} ${message ?? ''}`;

  if (text.includes('catalogVersionId') || text.includes('catalog_version_id')) {
    return new CatalogVersionResolutionExistsError();
  }
  if (text.includes('number')) {
    return new DuplicateResolutionNumberError();
  }
  return new ConflictError(
    'Ya existe una resolución con ese número y tipo, o la versión del catálogo ya tiene una resolución de ese tipo.',
  );
}

export class PrismaResolutionRepository implements ResolutionReader, ResolutionRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(id: string): Promise<Resolution | null> {
    const row = await this.dbProvider.get().resolution.findUnique({ where: { id } });
    return row ? mapPrismaResolutionRowToDomain(row) : null;
  }

  async list(filter: ListResolutionsFilter): Promise<ResolutionPage> {
    const where = {
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.catalogVersionId ? { catalogVersionId: filter.catalogVersionId } : {}),
    };
    const db = this.dbProvider.get();
    const rows = await db.resolution.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    });
    const total = await db.resolution.count({ where });
    return { items: rows.map(mapPrismaResolutionRowToDomain), total };
  }

  async save(resolution: Resolution): Promise<void> {
    try {
      await this.dbProvider.get().resolution.create({
        data: {
          id: resolution.id,
          type: resolution.type,
          number: resolution.number,
          issuedOn: resolution.issuedOn,
          status: resolution.status,
          catalogVersionId: resolution.catalogVersionId,
          createdBy: resolution.createdBy,
          createdAt: resolution.createdAt,
          updatedAt: resolution.updatedAt,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw classifyUniqueViolation(error);
      }
      throw error;
    }
  }

  async lockForApproval(id: string): Promise<Resolution | null> {
    this.assertInTransaction('lockForApproval');
    await this.dbProvider
      .get()
      .$queryRawUnsafe('SELECT "id" FROM "resolutions" WHERE "id" = $1 FOR UPDATE', id);
    // Se lee después del bloqueo para ver el estado confirmado por la última transacción.
    return await this.findById(id);
  }

  async approve(id: string, pdf: ResolutionPdf, actorId: string, now: Date): Promise<boolean> {
    this.assertInTransaction('approve');
    const db = this.dbProvider.get();
    await db.storedFile.create({
      data: {
        id: pdf.fileId,
        provider: pdf.provider,
        publicId: pdf.publicId,
        url: pdf.url,
        mimeType: pdf.mimeType,
        sizeBytes: pdf.sizeBytes,
        sha256: pdf.sha256,
        createdAt: now,
      },
    });
    const result = await db.resolution.updateMany({
      where: { id, status: 'REGISTERED' },
      data: {
        status: 'APPROVED',
        pdfFileId: pdf.fileId,
        approvedAt: now,
        approvedBy: actorId,
        updatedAt: now,
      },
    });
    if (result.count !== 1) {
      await db.storedFile.deleteMany({ where: { id: pdf.fileId } });
      return false;
    }
    return true;
  }

  private assertInTransaction(operation: string): void {
    if (!(this.dbProvider.isInTransaction?.() ?? false)) {
      throw new Error(
        `${operation} solo puede ejecutarse dentro de una transacción activa (UnitOfWork).`,
      );
    }
  }
}
