import { describe, it, expect, vi } from 'vitest';
import { CreateReferenceItemUseCase } from './create-reference-item.js';
import type { ReferenceItemRepository } from '../domain/ports/reference-item-repository.js';
import type { ReferenceItem } from '../domain/entities/reference-item.js';
import { InMemoryAuditLogger } from '../../../shared/audit/in-memory-audit-logger.js';
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
  it('runs the creation inside the unit of work, logs audit event, and returns a dto', async () => {
    const repository = new InMemoryReferenceItemRepo();
    const fakeUnitOfWork: UnitOfWork = {
      run: vi.fn(async (work) => await work()),
    };
    const auditLogger = new InMemoryAuditLogger();

    const useCase = new CreateReferenceItemUseCase(repository, fakeUnitOfWork, auditLogger);

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

    // Validación de auditoría obligatoria (RS-041, RS-043, RNF-016)
    expect(auditLogger.events).toHaveLength(1);
    expect(auditLogger.events[0]).toEqual({
      action: 'CREATE',
      entity: 'ReferenceItem',
      entityId: dto.id,
      after: {
        id: dto.id,
        code: 'REF-001',
        title: 'Item de Referencia',
        status: 'DRAFT',
        createdAt: dto.createdAt,
      },
    });
  });

  it('rejects a duplicated code with ConflictError and does not record audit event', async () => {
    const repository = new InMemoryReferenceItemRepo();
    const fakeUnitOfWork: UnitOfWork = {
      run: async (work) => await work(),
    };
    const auditLogger = new InMemoryAuditLogger();

    const useCase = new CreateReferenceItemUseCase(repository, fakeUnitOfWork, auditLogger);

    await useCase.execute({
      code: 'REF-DUP',
      title: 'Primer Ítem',
    });

    expect(auditLogger.events).toHaveLength(1);

    await expect(
      useCase.execute({
        code: 'REF-DUP',
        title: 'Segundo Ítem con mismo código',
      }),
    ).rejects.toThrow(ReferenceItemAlreadyExistsError);

    // No debe haber un segundo evento de auditoría
    expect(auditLogger.events).toHaveLength(1);
  });

  it('propagates audit failure rejecting the execution', async () => {
    const repository = new InMemoryReferenceItemRepo();
    const fakeUnitOfWork: UnitOfWork = {
      run: async (work) => await work(),
    };
    const auditLogger = new InMemoryAuditLogger();
    auditLogger.simulateFailure = new Error('Database connection lost during audit');

    const useCase = new CreateReferenceItemUseCase(repository, fakeUnitOfWork, auditLogger);

    await expect(
      useCase.execute({
        code: 'REF-FAIL',
        title: 'Ítem que falla en auditoría',
      }),
    ).rejects.toThrow('Database connection lost during audit');
  });
});
