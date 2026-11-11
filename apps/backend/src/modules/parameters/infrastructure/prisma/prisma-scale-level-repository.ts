import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { ScaleLevel } from '../../domain/entities/response-scale.js';
import type { ScaleLevelRepository } from '../../domain/ports/scale-level-repository.js';

export class PrismaScaleLevelRepository implements ScaleLevelRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async replaceLevels(scaleId: string, levels: readonly ScaleLevel[]): Promise<void> {
    const inTx = this.dbProvider.isInTransaction?.() ?? false;
    if (!inTx) {
      throw new Error(
        'replaceLevels solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
      );
    }

    const client = this.dbProvider.get();
    await client.scaleLevel.deleteMany({ where: { scaleId } });
    await client.scaleLevel.createMany({
      data: levels.map((level) => ({
        scaleId,
        order: level.order,
        label: level.label,
        value: level.value,
        countsAsAchievement: level.countsAsAchievement,
      })),
    });
  }
}
