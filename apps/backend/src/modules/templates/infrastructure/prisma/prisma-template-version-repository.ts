import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  TemplateVersion,
  TemplateVersionStatus,
} from '../../domain/entities/template-version.js';
import {
  TemplateDraftExistsError,
  TemplatePublishedExistsError,
  TemplateVersionNumberConflictError,
} from '../../domain/errors/index.js';
import type {
  CurrentTemplateVersions,
  TemplateVersionReader,
} from '../../domain/ports/template-version-reader.js';
import type { TemplateVersionRepository } from '../../domain/ports/template-version-repository.js';
import {
  mapPrismaTemplateVersionRowToDomain,
  type PrismaTemplateVersionRow,
} from './prisma-template-version-mapper.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

/** Texto de la violación (meta y mensaje) para distinguir qué índice único se rompió. */
function violationText(error: unknown): string {
  const { meta, message } = error as { meta?: unknown; message?: string };
  return `${JSON.stringify(meta ?? {})} ${message ?? ''}`;
}

const toDomain = (row: unknown): TemplateVersion =>
  mapPrismaTemplateVersionRowToDomain(row as PrismaTemplateVersionRow);

export class PrismaTemplateVersionRepository
  implements TemplateVersionReader, TemplateVersionRepository
{
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(id: string): Promise<TemplateVersion | null> {
    const row = await this.dbProvider.get().templateVersion.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findPublishedByCode(code: string): Promise<TemplateVersion | null> {
    const row = await this.dbProvider
      .get()
      .templateVersion.findFirst({ where: { status: 'PUBLISHED', template: { code } } });
    return row ? toDomain(row) : null;
  }

  async findDraft(templateId: string): Promise<TemplateVersion | null> {
    const row = await this.dbProvider
      .get()
      .templateVersion.findFirst({ where: { templateId, status: 'DRAFT' } });
    return row ? toDomain(row) : null;
  }

  async findPublished(templateId: string): Promise<TemplateVersion | null> {
    const row = await this.dbProvider
      .get()
      .templateVersion.findFirst({ where: { templateId, status: 'PUBLISHED' } });
    return row ? toDomain(row) : null;
  }

  async listByTemplate(templateId: string): Promise<TemplateVersion[]> {
    const rows = await this.dbProvider.get().templateVersion.findMany({
      where: { templateId },
      orderBy: { number: 'desc' },
    });
    return rows.map(toDomain);
  }

  async findCurrentByTemplateIds(
    templateIds: readonly string[],
  ): Promise<ReadonlyMap<string, CurrentTemplateVersions>> {
    const result = new Map<string, CurrentTemplateVersions>();
    if (templateIds.length === 0) {
      return result;
    }
    const rows = await this.dbProvider.get().templateVersion.findMany({
      where: { templateId: { in: [...templateIds] }, status: { in: ['PUBLISHED', 'DRAFT'] } },
    });
    for (const templateId of templateIds) {
      result.set(templateId, { published: null, draft: null });
    }
    for (const row of rows) {
      const version = toDomain(row);
      const current = result.get(version.templateId) ?? { published: null, draft: null };
      result.set(
        version.templateId,
        version.status === 'PUBLISHED'
          ? { ...current, published: version }
          : { ...current, draft: version },
      );
    }
    return result;
  }

  async maxNumber(templateId: string): Promise<number> {
    const result = await this.dbProvider
      .get()
      .templateVersion.aggregate({ where: { templateId }, _max: { number: true } });
    return result._max.number ?? 0;
  }

  async saveDraft(version: TemplateVersion): Promise<void> {
    this.assertInTransaction('saveDraft');
    try {
      await this.dbProvider.get().templateVersion.create({
        data: {
          id: version.id,
          templateId: version.templateId,
          number: version.number,
          status: version.status,
          content: version.content,
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
          throw new TemplateVersionNumberConflictError();
        }
        throw new TemplateDraftExistsError();
      }
      throw error;
    }
  }

  async updateDraftContent(
    id: string,
    content: string,
    actorId: string,
    now: Date,
  ): Promise<boolean> {
    this.assertInTransaction('updateDraftContent');
    const result = await this.dbProvider.get().templateVersion.updateMany({
      where: { id, status: 'DRAFT' },
      data: { content, updatedBy: actorId, updatedAt: now },
    });
    return result.count === 1;
  }

  async transitionStatus(
    id: string,
    from: TemplateVersionStatus,
    to: TemplateVersionStatus,
    actorId: string,
    now: Date,
  ): Promise<boolean> {
    this.assertInTransaction('transitionStatus');
    try {
      const result = await this.dbProvider.get().templateVersion.updateMany({
        where: { id, status: from },
        data: {
          status: to,
          updatedBy: actorId,
          updatedAt: now,
          ...(to === 'PUBLISHED' ? { publishedAt: now, publishedBy: actorId } : {}),
        },
      });
      return result.count === 1;
    } catch (error) {
      if (to === 'PUBLISHED' && isUniqueViolation(error)) {
        throw new TemplatePublishedExistsError();
      }
      throw error;
    }
  }

  private assertInTransaction(method: string): void {
    if (!(this.dbProvider.isInTransaction?.() ?? false)) {
      throw new Error(
        `${method} solo puede ejecutarse dentro de una transacción activa (UnitOfWork).`,
      );
    }
  }
}
