import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { Template } from '../../domain/entities/template.js';
import type {
  ListTemplatesFilter,
  TemplatePage,
  TemplateReader,
} from '../../domain/ports/template-reader.js';
import type { TemplateRepository } from '../../domain/ports/template-repository.js';
import { mapPrismaTemplateRowToDomain, type PrismaTemplateRow } from './prisma-template-mapper.js';

export class PrismaTemplateRepository implements TemplateReader, TemplateRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(id: string): Promise<Template | null> {
    const row = await this.dbProvider.get().template.findUnique({ where: { id } });
    return row ? mapPrismaTemplateRowToDomain(row as PrismaTemplateRow) : null;
  }

  async findByCode(code: string): Promise<Template | null> {
    const row = await this.dbProvider.get().template.findUnique({ where: { code } });
    return row ? mapPrismaTemplateRowToDomain(row as PrismaTemplateRow) : null;
  }

  async list(filter: ListTemplatesFilter): Promise<TemplatePage> {
    const where = filter.type ? { type: filter.type } : {};
    const db = this.dbProvider.get();
    const [rows, total] = await Promise.all([
      db.template.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      db.template.count({ where }),
    ]);
    return {
      items: rows.map((row) => mapPrismaTemplateRowToDomain(row as PrismaTemplateRow)),
      total,
    };
  }

  async lockForUpdate(templateId: string): Promise<Template | null> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'lockForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }
    await this.dbProvider
      .get()
      .$queryRawUnsafe('SELECT "id" FROM "templates" WHERE "id" = $1 FOR UPDATE', templateId);
    // Se lee después del bloqueo para ver lo confirmado por la última transacción.
    return await this.findById(templateId);
  }
}
