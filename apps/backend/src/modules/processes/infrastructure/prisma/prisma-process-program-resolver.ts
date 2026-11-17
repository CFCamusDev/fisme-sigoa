import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { ProcessProgramResolver } from '../../domain/ports/process-program-resolver.js';

/** Resuelve el programa actual de la tabla `programs` sin importar el módulo `parameters`. */
export class PrismaProcessProgramResolver implements ProcessProgramResolver {
  constructor(private readonly dbProvider: DbProvider) {}

  async getCurrentProgramId(): Promise<string | null> {
    const row = await this.dbProvider.get().program.findFirst({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return row?.id ?? null;
  }
}
