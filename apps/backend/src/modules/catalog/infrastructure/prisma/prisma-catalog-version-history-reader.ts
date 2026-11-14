import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  CatalogVersionHistoryReader,
  CatalogVersionResolutionRecord,
} from '../../domain/ports/catalog-version-history-reader.js';

/**
 * Lee las resoluciones OE/AG vinculadas a las versiones de un programa directamente de la tabla
 * `resolutions`, sin importar el interior del módulo `resolutions` (D7 de la HU-017). Solo lectura;
 * nunca selecciona quién registró o aprobó la resolución.
 */
export class PrismaCatalogVersionHistoryReader implements CatalogVersionHistoryReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async listForProgram(
    programId: string,
  ): Promise<ReadonlyMap<string, readonly CatalogVersionResolutionRecord[]>> {
    const rows = await this.dbProvider.get().resolution.findMany({
      where: {
        catalogVersion: { programId },
        type: { in: ['EDUCATIONAL_OBJECTIVE', 'GRADUATE_ATTRIBUTE'] },
      },
      select: {
        id: true,
        type: true,
        number: true,
        issuedOn: true,
        status: true,
        approvedAt: true,
        pdfFileId: true,
        catalogVersionId: true,
      },
      orderBy: [{ issuedOn: 'asc' }, { type: 'asc' }, { id: 'asc' }],
    });

    const byVersion = new Map<string, CatalogVersionResolutionRecord[]>();
    for (const row of rows) {
      if (row.catalogVersionId === null) {
        continue;
      }
      const record: CatalogVersionResolutionRecord = {
        id: row.id,
        type: row.type,
        number: row.number,
        issuedOn: row.issuedOn,
        status: row.status,
        approvedAt: row.approvedAt,
        hasPdf: row.pdfFileId !== null,
      };
      const list = byVersion.get(row.catalogVersionId);
      if (list) {
        list.push(record);
      } else {
        byVersion.set(row.catalogVersionId, [record]);
      }
    }
    return byVersion;
  }
}
