import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ResponseScale } from '../domain/entities/response-scale.js';
import {
  InvalidResponseScaleDataError,
  ResponseScaleCodeAlreadyExistsError,
  ResponseScaleNotFoundError,
} from '../domain/errors/index.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ResponseScaleReader } from '../domain/ports/response-scale-reader.js';
import type { ResponseScaleRepository } from '../domain/ports/response-scale-repository.js';
import type { ScaleLevelRepository } from '../domain/ports/scale-level-repository.js';
import { DuplicateResponseScaleUseCase } from './duplicate-response-scale.js';

const NOW = new Date('2026-11-10T12:00:00.000Z');

function source(): ResponseScale {
  return ResponseScale.create({
    id: 'source-1',
    code: 'EVIDENCE_4',
    name: 'Evidencia 4',
    type: 'EVIDENCE',
    levels: [
      { order: 1, label: 'No se evidencia', value: 1, countsAsAchievement: false },
      { order: 2, label: 'Se evidencia mayormente', value: 3, countsAsAchievement: true },
      { order: 3, label: 'Se evidencia totalmente', value: 4, countsAsAchievement: true },
    ],
    createdBy: 'seed',
    updatedBy: 'seed',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('DuplicateResponseScaleUseCase (T-012-08, T-012-21, RF-012, CA3, RS-020)', () => {
  let scaleReader: MockProxy<ResponseScaleReader>;
  let scaleRepository: MockProxy<ResponseScaleRepository>;
  let levelRepository: MockProxy<ScaleLevelRepository>;
  let permissionChecker: MockProxy<ParametersPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: DuplicateResponseScaleUseCase;

  const command = {
    actorId: 'admin_1',
    ip: '10.0.0.1',
    sourceId: 'source-1',
    code: 'EVIDENCE_4_V2',
    name: 'Evidencia 4 (v2)',
  };

  beforeEach(() => {
    scaleReader = mock<ResponseScaleReader>();
    scaleRepository = mock<ResponseScaleRepository>();
    levelRepository = mock<ScaleLevelRepository>();
    permissionChecker = mock<ParametersPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    scaleRepository.lockById.mockResolvedValue(source());
    scaleReader.findByCode.mockResolvedValue(null);
    useCase = new DuplicateResponseScaleUseCase({
      scaleReader,
      scaleRepository,
      levelRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'copy-1',
      clock: () => NOW,
    });
  });

  it('checks parametro.editar with GLOBAL scope before opening the transaction', async () => {
    await useCase.execute(command);

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

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(scaleRepository.lockById).not.toHaveBeenCalled();
    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('answers ResponseScaleNotFoundError when the source does not exist', async () => {
    scaleRepository.lockById.mockResolvedValue(null);

    await expect(useCase.execute({ ...command, sourceId: 'missing' })).rejects.toBeInstanceOf(
      ResponseScaleNotFoundError,
    );

    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('answers ResponseScaleCodeAlreadyExistsError when the new code is taken, writing nothing', async () => {
    scaleReader.findByCode.mockResolvedValue(source());

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      ResponseScaleCodeAlreadyExistsError,
    );

    expect(scaleReader.findByCode).toHaveBeenCalledWith('EVIDENCE_4_V2');
    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(levelRepository.replaceLevels).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('locks the source inside the transaction before copying it', async () => {
    await useCase.execute(command);

    expect(unitOfWork.run.mock.invocationCallOrder[0]).toBeLessThan(
      scaleRepository.lockById.mock.invocationCallOrder[0]!,
    );
    expect(scaleRepository.lockById).toHaveBeenCalledWith('source-1');
  });

  it('copies type and levels, including the counts-as-achievement flags, into a new scale', async () => {
    const dto = await useCase.execute(command);

    const saved = scaleRepository.save.mock.calls[0]![0];
    expect(saved.id).toBe('copy-1');
    expect(saved.code).toBe('EVIDENCE_4_V2');
    expect(saved.createdBy).toBe('admin_1');
    expect(levelRepository.replaceLevels).toHaveBeenCalledWith('copy-1', [
      { order: 1, label: 'No se evidencia', value: 1, countsAsAchievement: false },
      { order: 2, label: 'Se evidencia mayormente', value: 3, countsAsAchievement: true },
      { order: 3, label: 'Se evidencia totalmente', value: 4, countsAsAchievement: true },
    ]);
    expect(dto).toMatchObject({
      id: 'copy-1',
      code: 'EVIDENCE_4_V2',
      name: 'Evidencia 4 (v2)',
      type: 'EVIDENCE',
      inUse: false,
    });
    expect(dto.levels.map((level) => level.countsAsAchievement)).toEqual([false, true, true]);
  });

  it('audits one CREATE event with duplicatedFrom', async () => {
    await useCase.execute(command);

    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'ResponseScale',
        entityId: 'copy-1',
        actor: 'admin_1',
        ip: '10.0.0.1',
        before: null,
        after: expect.objectContaining({ code: 'EVIDENCE_4_V2', duplicatedFrom: 'EVIDENCE_4' }),
      }),
    );
  });

  it('rejects an invalid code for the copy and writes nothing', async () => {
    await expect(useCase.execute({ ...command, code: 'minuscula' })).rejects.toBeInstanceOf(
      InvalidResponseScaleDataError,
    );

    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
