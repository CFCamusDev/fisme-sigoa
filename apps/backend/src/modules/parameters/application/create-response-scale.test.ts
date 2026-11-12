import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ResponseScale } from '../domain/entities/response-scale.js';
import {
  InvalidResponseScaleDataError,
  ResponseScaleCodeAlreadyExistsError,
} from '../domain/errors/index.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ResponseScaleReader } from '../domain/ports/response-scale-reader.js';
import type { ResponseScaleRepository } from '../domain/ports/response-scale-repository.js';
import type { ScaleLevelRepository } from '../domain/ports/scale-level-repository.js';
import { CreateResponseScaleUseCase } from './create-response-scale.js';
import type { CreateResponseScaleCommand } from './create-response-scale.types.js';

const NOW = new Date('2026-11-10T12:00:00.000Z');

const command: CreateResponseScaleCommand = {
  actorId: 'admin_1',
  ip: '10.0.0.1',
  code: 'EVIDENCE_4',
  name: 'Evidencia 4',
  type: 'EVIDENCE',
  levels: [
    { label: 'No se evidencia', value: 1, countsAsAchievement: false },
    { label: 'Se evidencia totalmente', value: 2, countsAsAchievement: true },
  ],
};

describe('CreateResponseScaleUseCase (T-012-06, T-012-19, RF-012, RS-020)', () => {
  let scaleReader: MockProxy<ResponseScaleReader>;
  let scaleRepository: MockProxy<ResponseScaleRepository>;
  let levelRepository: MockProxy<ScaleLevelRepository>;
  let permissionChecker: MockProxy<ParametersPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: CreateResponseScaleUseCase;

  beforeEach(() => {
    scaleReader = mock<ResponseScaleReader>();
    scaleRepository = mock<ResponseScaleRepository>();
    levelRepository = mock<ScaleLevelRepository>();
    permissionChecker = mock<ParametersPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    scaleReader.findByCode.mockResolvedValue(null);
    useCase = new CreateResponseScaleUseCase({
      scaleReader,
      scaleRepository,
      levelRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'scale-new',
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

  it('does not open a transaction, write or audit when the permission is denied', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ForbiddenError);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(levelRepository.replaceLevels).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('saves the header, the levels with consecutive order and one CREATE event', async () => {
    const dto = await useCase.execute(command);

    const saved = scaleRepository.save.mock.calls[0]![0];
    expect(saved).toBeInstanceOf(ResponseScale);
    expect(saved.createdBy).toBe('admin_1');
    expect(levelRepository.replaceLevels).toHaveBeenCalledWith('scale-new', [
      { order: 1, label: 'No se evidencia', value: 1, countsAsAchievement: false },
      { order: 2, label: 'Se evidencia totalmente', value: 2, countsAsAchievement: true },
    ]);
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'ResponseScale',
        entityId: 'scale-new',
        actor: 'admin_1',
        ip: '10.0.0.1',
        before: null,
        after: expect.objectContaining({ code: 'EVIDENCE_4' }),
      }),
    );
    expect(dto).toEqual({
      id: 'scale-new',
      code: 'EVIDENCE_4',
      name: 'Evidencia 4',
      type: 'EVIDENCE',
      inUse: false,
      levels: [
        { order: 1, label: 'No se evidencia', value: 1, countsAsAchievement: false },
        { order: 2, label: 'Se evidencia totalmente', value: 2, countsAsAchievement: true },
      ],
    });
  });

  it('accepts the incomplete but valid scale with no achievement level', async () => {
    const dto = await useCase.execute({
      ...command,
      levels: [
        { label: 'A', value: 1, countsAsAchievement: false },
        { label: 'B', value: 2, countsAsAchievement: false },
      ],
    });

    expect(dto.levels.some((level) => level.countsAsAchievement)).toBe(false);
  });

  it('rejects an existing code with ResponseScaleCodeAlreadyExistsError and writes nothing', async () => {
    scaleReader.findByCode.mockResolvedValue(mock<ResponseScale>());

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      ResponseScaleCodeAlreadyExistsError,
    );

    expect(scaleReader.findByCode).toHaveBeenCalledWith('EVIDENCE_4');
    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(levelRepository.replaceLevels).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects invalid domain data even when the schema let it through', async () => {
    await expect(
      useCase.execute({ ...command, levels: [command.levels[0]!] }),
    ).rejects.toBeInstanceOf(InvalidResponseScaleDataError);

    expect(scaleRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('propagates a failure of the level repository without auditing', async () => {
    levelRepository.replaceLevels.mockRejectedValue(new Error('db down'));

    await expect(useCase.execute(command)).rejects.toThrow('db down');

    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
