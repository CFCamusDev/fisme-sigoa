import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ResponseScale } from '../domain/entities/response-scale.js';
import {
  InvalidResponseScaleDataError,
  ResponseScaleInUseError,
  ResponseScaleNotFoundError,
} from '../domain/errors/index.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ResponseScaleRepository } from '../domain/ports/response-scale-repository.js';
import type { ScaleLevelRepository } from '../domain/ports/scale-level-repository.js';
import type { ScaleUsageReader } from '../domain/ports/scale-usage-reader.js';
import { EditResponseScaleUseCase } from './edit-response-scale.js';

function existingScale(): ResponseScale {
  return ResponseScale.create({
    id: 'scale-1',
    code: 'LIKERT_5',
    name: 'Likert 5',
    type: 'LIKERT',
    levels: [
      { order: 1, label: 'Bajo', value: 1, countsAsAchievement: false },
      { order: 2, label: 'Alto', value: 2, countsAsAchievement: true },
    ],
    createdBy: 'seed',
    updatedBy: 'seed',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('EditResponseScaleUseCase (T-012-07, T-012-20, RF-012, CA3, RS-020)', () => {
  let scaleRepository: MockProxy<ResponseScaleRepository>;
  let levelRepository: MockProxy<ScaleLevelRepository>;
  let scaleUsageReader: MockProxy<ScaleUsageReader>;
  let permissionChecker: MockProxy<ParametersPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: EditResponseScaleUseCase;

  beforeEach(() => {
    scaleRepository = mock<ResponseScaleRepository>();
    levelRepository = mock<ScaleLevelRepository>();
    scaleUsageReader = mock<ScaleUsageReader>();
    permissionChecker = mock<ParametersPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    scaleRepository.lockById.mockResolvedValue(existingScale());
    scaleUsageReader.isInUse.mockResolvedValue(false);
    useCase = new EditResponseScaleUseCase({
      scaleRepository,
      levelRepository,
      scaleUsageReader,
      permissionChecker,
      unitOfWork,
      auditLogger,
    });
  });

  const newLevels = [
    { label: 'No', value: 0, countsAsAchievement: false },
    { label: 'Sí', value: 10, countsAsAchievement: true },
    { label: 'Quizá', value: 5, countsAsAchievement: false },
  ];

  it('checks parametro.editar with GLOBAL scope before opening the transaction', async () => {
    await useCase.execute({ actorId: 'admin_1', id: 'scale-1', name: 'Otro' });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'admin_1',
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });
    expect(permissionChecker.assertAllowed.mock.invocationCallOrder[0]).toBeLessThan(
      unitOfWork.run.mock.invocationCallOrder[0]!,
    );
  });

  it('does not open a transaction, lock, write or audit when the permission is denied', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({ actorId: 'u', id: 'scale-1', name: 'Otro' }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(scaleRepository.lockById).not.toHaveBeenCalled();
    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('answers ResponseScaleNotFoundError when the scale does not exist', async () => {
    scaleRepository.lockById.mockResolvedValue(null);

    await expect(
      useCase.execute({ actorId: 'admin_1', id: 'missing', name: 'Otro' }),
    ).rejects.toBeInstanceOf(ResponseScaleNotFoundError);

    expect(scaleUsageReader.isInUse).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects an in-use scale and suggests duplicating it, without writing', async () => {
    scaleUsageReader.isInUse.mockResolvedValue(true);

    const attempt = useCase.execute({ actorId: 'admin_1', id: 'scale-1', name: 'Otro' });

    await expect(attempt).rejects.toBeInstanceOf(ResponseScaleInUseError);
    await expect(attempt).rejects.toThrow(/Duplícala/);
    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(levelRepository.replaceLevels).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('checks the usage after locking the scale, inside the transaction', async () => {
    await useCase.execute({ actorId: 'admin_1', id: 'scale-1', name: 'Otro' });

    expect(unitOfWork.run.mock.invocationCallOrder[0]).toBeLessThan(
      scaleRepository.lockById.mock.invocationCallOrder[0]!,
    );
    expect(scaleRepository.lockById.mock.invocationCallOrder[0]).toBeLessThan(
      scaleUsageReader.isInUse.mock.invocationCallOrder[0]!,
    );
  });

  it('reports the in-use conflict before the domain validation of the body (D19)', async () => {
    scaleUsageReader.isInUse.mockResolvedValue(true);

    await expect(
      useCase.execute({
        actorId: 'admin_1',
        id: 'scale-1',
        levels: [{ label: 'Solo uno', value: 1, countsAsAchievement: false }],
      }),
    ).rejects.toBeInstanceOf(ResponseScaleInUseError);
  });

  it('saves the header and replaces the levels, auditing an UPDATE with before and after', async () => {
    const dto = await useCase.execute({
      actorId: 'admin_1',
      ip: '10.0.0.1',
      id: 'scale-1',
      name: '  Nueva  ',
      levels: newLevels,
    });

    expect(scaleRepository.save).toHaveBeenCalledTimes(1);
    expect(levelRepository.replaceLevels).toHaveBeenCalledWith('scale-1', [
      { order: 1, label: 'No', value: 0, countsAsAchievement: false },
      { order: 2, label: 'Sí', value: 10, countsAsAchievement: true },
      { order: 3, label: 'Quizá', value: 5, countsAsAchievement: false },
    ]);
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    const event = auditLogger.log.mock.calls[0]![0];
    expect(event).toMatchObject({
      action: 'UPDATE',
      entity: 'ResponseScale',
      entityId: 'scale-1',
      actor: 'admin_1',
      ip: '10.0.0.1',
    });
    expect((event.before as { name: string; levels: unknown[] }).name).toBe('Likert 5');
    expect((event.before as { levels: unknown[] }).levels).toHaveLength(2);
    expect((event.after as { name: string }).name).toBe('Nueva');
    expect((event.after as { levels: unknown[] }).levels).toHaveLength(3);
    expect(dto).toMatchObject({ name: 'Nueva', inUse: false });
    expect(dto.levels).toHaveLength(3);
  });

  it('does not replace the levels when only the name changes', async () => {
    await useCase.execute({ actorId: 'admin_1', id: 'scale-1', name: 'Solo nombre' });

    expect(scaleRepository.save).toHaveBeenCalledTimes(1);
    expect(levelRepository.replaceLevels).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
  });

  it('does not touch the name when only the levels are sent', async () => {
    const dto = await useCase.execute({ actorId: 'admin_1', id: 'scale-1', levels: newLevels });

    expect(dto.name).toBe('Likert 5');
    expect(levelRepository.replaceLevels).toHaveBeenCalledTimes(1);
  });

  it('answers the current view without writing or auditing when nothing changes (D18)', async () => {
    const dto = await useCase.execute({
      actorId: 'admin_1',
      id: 'scale-1',
      name: 'Likert 5',
      levels: [
        { label: 'Bajo', value: 1, countsAsAchievement: false },
        { label: 'Alto', value: 2, countsAsAchievement: true },
      ],
    });

    expect(dto.name).toBe('Likert 5');
    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(levelRepository.replaceLevels).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('counts a change of the counts-as-achievement flag as a change', async () => {
    await useCase.execute({
      actorId: 'admin_1',
      id: 'scale-1',
      levels: [
        { label: 'Bajo', value: 1, countsAsAchievement: true },
        { label: 'Alto', value: 2, countsAsAchievement: true },
      ],
    });

    expect(levelRepository.replaceLevels).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid domain data even when the schema let it through, without writing', async () => {
    await expect(
      useCase.execute({
        actorId: 'admin_1',
        id: 'scale-1',
        levels: [
          { label: 'Igual', value: 1, countsAsAchievement: false },
          { label: 'igual', value: 2, countsAsAchievement: false },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidResponseScaleDataError);

    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(levelRepository.replaceLevels).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
