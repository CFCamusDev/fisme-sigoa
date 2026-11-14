import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  ResolutionCatalogVersionReader,
  ResolutionCatalogVersionSummary,
} from '../../domain/ports/resolution-catalog-version-reader.js';

/** Lee `catalog_versions` sin importar el interior del módulo `catalog`. */
export class PrismaResolutionCatalogVersionReader implements ResolutionCatalogVersionReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(versionId: string): Promise<ResolutionCatalogVersionSummary | null> {
    const row = await this.dbProvider.get().catalogVersion.findUnique({
      where: { id: versionId },
      select: { id: true, status: true },
    });
    return row ? { id: row.id, status: row.status } : null;
  }
}
