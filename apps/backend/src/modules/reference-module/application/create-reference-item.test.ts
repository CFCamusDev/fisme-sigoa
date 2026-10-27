import { describe, it, expect, vi } from 'vitest';
import { CreateReferenceItemUseCase } from './create-reference-item.js';
import type { ReferenceItemRepository } from '../domain/ports/reference-item-repository.js';
import type { ReferenceItem } from '../domain/entities/reference-item.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ReferenceItemAlreadyExistsError } from '../domain/errors/reference-item-already-exists-error.js';

class InMemoryReferenceItemRepo implements ReferenceItemRepository {
  private items = new Map<string, ReferenceItem>();

  async findById(id: string): Promise<ReferenceItem | null> {
    return this.items.get(id) ?? null;
  }

  async findByCode(code: string): Promise<ReferenceItem | null> {
    for (const item of this.items.values()) {
      if (item.code === code) return item;
    }
    return null;
  }

  async save(item: ReferenceItem): Promise<void> {
    this.items.set(item.id, item);
  }
}

describe('CreateReferenceItemUseCase', () => {
  it('runs the creation inside the unit of work and returns a dto', async () => {
    const repository = new InMemoryReferenceItemRepo();
    const fakeUnitOfWork: UnitOfWork = {
      run: vi.fn(async (work) => await work()),
    };

    const useCase = new CreateReferenceItemUseCase(repository, fakeUnitOfWork);

    const dto = await useCase.execute({
      code: 'REF-001',
      title: 'Item de Referencia',
    });

    expect(dto.id).toBeDefined();
    expect(dto.code).toBe('REF-001');
    expect(dto.title).toBe('Item de Referencia');
    expect(dto.status).toBe('DRAFT');
    expect(fakeUnitOfWork.run).toHaveBeenCalledTimes(1);

    const stored = await repository.findByCode('REF-001');
    expect(stored).not.toBeNull();
    expect(stored?.title).toBe('Item de Referencia');
  });

  it('rejects a duplicated code with ConflictError', async () => {
    const repository = new InMemoryReferenceItemRepo();
    const fakeUnitOfWork: UnitOfWork = {
      run: async (work) => await work(),
    };

    const useCase = new CreateReferenceItemUseCase(repository, fakeUnitOfWork);

    await useCase.execute({
      code: 'REF-DUP',
      title: 'Primer Ítem',
    });

    await expect(
      useCase.execute({
        code: 'REF-DUP',
        title: 'Segundo Ítem con mismo código',
      }),
    ).rejects.toThrow(ReferenceItemAlreadyExistsError);
  });
});
