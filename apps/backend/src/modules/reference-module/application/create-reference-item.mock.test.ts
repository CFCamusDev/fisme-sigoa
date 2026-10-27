import { beforeEach, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { ReferenceItemRepository } from '../domain/ports/reference-item-repository.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ReferenceItem } from '../domain/entities/reference-item.js';
import { ReferenceItemAlreadyExistsError } from '../domain/errors/reference-item-already-exists-error.js';
import { CreateReferenceItemUseCase } from './create-reference-item.js';

describe('CreateReferenceItemUseCase (with vitest-mock-extended)', () => {
  const repositoryMock = mock<ReferenceItemRepository>();
  const unitOfWorkMock = mock<UnitOfWork>();
  const auditLoggerMock = mock<AuditLogger>();
  let useCase: CreateReferenceItemUseCase;

  beforeEach(() => {
    repositoryMock.findByCode.mockReset();
    repositoryMock.save.mockReset();
    unitOfWorkMock.run.mockReset();
    auditLoggerMock.log.mockReset();

    // Por defecto, UnitOfWork ejecuta directamente la función transaccional
    unitOfWorkMock.run.mockImplementation(async (work) => work());
    auditLoggerMock.log.mockResolvedValue();

    useCase = new CreateReferenceItemUseCase(repositoryMock, unitOfWorkMock, auditLoggerMock);
  });

  it('creates reference item and persists it when code is unique', async () => {
    repositoryMock.findByCode.mockResolvedValue(null);
    repositoryMock.save.mockResolvedValue();

    const result = await useCase.execute({
      code: 'REF-MOCK-001',
      title: 'Item creado con mock',
    });

    expect(result.code).toBe('REF-MOCK-001');
    expect(result.title).toBe('Item creado con mock');
    expect(result.status).toBe('DRAFT');
    expect(result.id).toBeDefined();

    expect(unitOfWorkMock.run).toHaveBeenCalledTimes(1);
    expect(repositoryMock.findByCode).toHaveBeenCalledWith('REF-MOCK-001');
    expect(repositoryMock.save).toHaveBeenCalledTimes(1);

    const savedEntity = repositoryMock.save.mock.calls[0]?.[0];
    expect(savedEntity).toBeInstanceOf(ReferenceItem);
    expect(savedEntity?.code).toBe('REF-MOCK-001');

    // Comprobamos la llamada a AuditLogger con vitest-mock-extended (RS-041, RS-043)
    expect(auditLoggerMock.log).toHaveBeenCalledTimes(1);
    expect(auditLoggerMock.log).toHaveBeenCalledWith({
      action: 'CREATE',
      entity: 'ReferenceItem',
      entityId: result.id,
      after: {
        id: result.id,
        code: 'REF-MOCK-001',
        title: 'Item creado con mock',
        status: 'DRAFT',
        createdAt: result.createdAt,
      },
    });
  });

  it('throws ReferenceItemAlreadyExistsError and does not call save or audit if code already exists', async () => {
    const existingEntity = ReferenceItem.create({
      code: 'REF-MOCK-002',
      title: 'Item preexistente',
    });
    repositoryMock.findByCode.mockResolvedValue(existingEntity);

    await expect(
      useCase.execute({
        code: 'REF-MOCK-002',
        title: 'Item duplicado',
      }),
    ).rejects.toThrow(ReferenceItemAlreadyExistsError);

    expect(repositoryMock.findByCode).toHaveBeenCalledWith('REF-MOCK-002');
    expect(repositoryMock.save).not.toHaveBeenCalled();
    expect(auditLoggerMock.log).not.toHaveBeenCalled();
  });
});
