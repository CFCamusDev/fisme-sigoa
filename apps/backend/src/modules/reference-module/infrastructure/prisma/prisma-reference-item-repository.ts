import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { ReferenceItem } from '../../domain/entities/reference-item.js';
import type { ReferenceItemRepository } from '../../domain/ports/reference-item-repository.js';

/**
 * Molde de repositorio Prisma para módulos reales:
 * - Recibe `DbProvider` por inyección de dependencias en el constructor.
 * - Utiliza `this.dbProvider.get()` en cada operación:
 *   dentro de `UnitOfWork.run()` devuelve el cliente transaccional activo (TxClient);
 *   fuera de `UnitOfWork.run()` devuelve el cliente Prisma regular.
 */
export class PrismaReferenceItemRepository implements ReferenceItemRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(_id: string): Promise<ReferenceItem | null> {
    // Ejemplo:
    // const client = this.dbProvider.get();
    // const row = await client.referenceItem.findUnique({ where: { id: _id } });
    // return row ? ReferenceItem.fromPersistence(row) : null;
    return null;
  }

  async findByCode(_code: string): Promise<ReferenceItem | null> {
    // const client = this.dbProvider.get();
    // const row = await client.referenceItem.findUnique({ where: { code: _code } });
    // return row ? ReferenceItem.fromPersistence(row) : null;
    return null;
  }

  async save(_item: ReferenceItem): Promise<void> {
    // const client = this.dbProvider.get();
    // await client.referenceItem.upsert({ ... });
  }
}
