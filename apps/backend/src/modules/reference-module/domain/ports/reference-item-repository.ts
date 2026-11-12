import type { ReferenceItem } from '../entities/reference-item.js';

export interface ReferenceItemRepository {
  findById(id: string): Promise<ReferenceItem | null>;
  findByCode(code: string): Promise<ReferenceItem | null>;
  save(item: ReferenceItem): Promise<void>;
}
