import type { ReferenceItem } from '../../domain/entities/reference-item.js';
import type { ReferenceItemRepository } from '../../domain/ports/reference-item-repository.js';

export class InMemoryReferenceItemRepository implements ReferenceItemRepository {
  private readonly items = new Map<string, ReferenceItem>();

  async findById(id: string): Promise<ReferenceItem | null> {
    return this.items.get(id) ?? null;
  }

  async findByCode(code: string): Promise<ReferenceItem | null> {
    for (const item of this.items.values()) {
      if (item.code === code) {
        return item;
      }
    }
    return null;
  }

  async save(item: ReferenceItem): Promise<void> {
    this.items.set(item.id, item);
  }
}
