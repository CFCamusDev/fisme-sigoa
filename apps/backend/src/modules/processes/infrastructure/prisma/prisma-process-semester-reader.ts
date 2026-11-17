import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type {
  ProcessSemesterReader,
  ProcessSemesterRecord,
} from '../../domain/ports/process-semester-reader.js';

/** Lee semestres de la tabla `semesters` sin importar el módulo `parameters`. */
export class PrismaProcessSemesterReader implements ProcessSemesterReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(id: string): Promise<ProcessSemesterRecord | null> {
    const row = await this.dbProvider.get().semester.findUnique({
      where: { id },
      select: { id: true, code: true },
    });
    if (!row) {
      return null;
    }
    return { id: row.id, code: row.code };
  }
}
