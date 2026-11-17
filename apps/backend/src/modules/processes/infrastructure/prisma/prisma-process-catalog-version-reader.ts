import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { ProcessCatalogVersionStatus } from '../../domain/policies/process-catalog-version-rule.js';
import type {
  ProcessCatalogVersionReader,
  ProcessCatalogVersionRecord,
} from '../../domain/ports/process-catalog-version-reader.js';

/** Lee versiones de catálogo de la tabla `catalog_versions` sin importar el módulo `catalog`. */
export class PrismaProcessCatalogVersionReader implements ProcessCatalogVersionReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(id: string): Promise<ProcessCatalogVersionRecord | null> {
    const row = await this.dbProvider.get().catalogVersion.findUnique({
      where: { id },
      select: { id: true, number: true, programId: true, status: true },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      number: row.number,
      programId: row.programId,
      status: row.status as ProcessCatalogVersionStatus,
    };
  }
}
