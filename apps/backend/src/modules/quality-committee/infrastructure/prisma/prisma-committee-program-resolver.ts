import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { CommitteeProgramResolver } from '../../domain/ports/committee-program-resolver.js';

/** Resuelve el programa actual de la tabla `programs` sin importar el módulo `parameters`. */
export class PrismaCommitteeProgramResolver implements CommitteeProgramResolver {
  constructor(private readonly dbProvider: DbProvider) {}

  async getCurrentProgramId(): Promise<string | null> {
    const row = await this.dbProvider.get().program.findFirst({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });

    return row?.id ?? null;
  }
}
