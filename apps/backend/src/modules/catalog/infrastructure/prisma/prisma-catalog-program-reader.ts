import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { CatalogProgramReader } from '../../domain/ports/catalog-program-reader.js';

/** Lee el programa de la tabla `programs` sin importar el interior del módulo `parameters`. */
export class PrismaCatalogProgramReader implements CatalogProgramReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async getCurrentProgramId(): Promise<string | null> {
    const row = await this.dbProvider.get().program.findFirst({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return row?.id ?? null;
  }
}
