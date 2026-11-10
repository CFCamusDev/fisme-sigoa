import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Parameter } from '../domain/entities/parameter.js';
import { Semester } from '../domain/entities/semester.js';
import {
  InvalidParameterDataError,
  ParameterSemesterNotFoundError,
} from '../domain/errors/index.js';
import type { ParameterVersion } from '../domain/ports/parameter-reader.js';
import type { ParameterRepository } from '../domain/ports/parameter-repository.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { SemesterReader } from '../domain/ports/semester-reader.js';
import { DefineParametersUseCase } from './define-parameters.js';
import type { DefineParametersCommand } from './define-parameters.types.js';

const NOW = new Date('2026-11-10T12:00:00.000Z');

function defaultVersion(id: string, key: string, value: number): ParameterVersion {
  return {
    parameter: Parameter.create({
      id,
      key,
      value,
      effectiveFromSemesterId: null,
      createdBy: 'SEED',
      updatedBy: 'SEED',
      createdAt: NOW,
      updatedAt: NOW,
    }),
    semesterCode: null,
    semesterStartDate: null,
  };
}

function metaVersionFor2027I(value: number): ParameterVersion {
  return {
    parameter: Parameter.create({
      id: 'v_meta',
      key: 'META_AG',
      value,
      effectiveFromSemesterId: 's27a',
      createdBy: 'admin_0',
      updatedBy: 'admin_0',
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    }),
    semesterCode: '2027-I',
    semesterStartDate: '2027-03-01',
  };
}

const DEFAULTS: ParameterVersion[] = [
  defaultVersion('d1', 'UMBRAL_LOGRADO', 14),
  defaultVersion('d2', 'META_AG', 70),
  defaultVersion('d3', 'PESO_DIRECTA', 70),
  defaultVersion('d4', 'PESO_INDIRECTA', 30),
  defaultVersion('d5', 'MIN_PARTICIPACION', 3),
  defaultVersion('d6', 'TOKEN_DIAS', 7),
  defaultVersion('d7', 'LOGIN_INTENTOS', 5),
];

describe('DefineParametersUseCase (T-011-05, T-011-16, RF-011, RS-020)', () => {
  let parameterRepository: ParameterRepository;
  let semesterReader: SemesterReader;
  let permissionChecker: ParametersPermissionChecker;
  let unitOfWork: UnitOfWork;
  let auditLogger: AuditLogger;
  let useCase: DefineParametersUseCase;

  beforeEach(() => {
    parameterRepository = {
      lockAndListVersions: vi.fn().mockResolvedValue(DEFAULTS),
      save: vi.fn().mockResolvedValue(undefined),
    };
    semesterReader = {
      list: vi.fn().mockResolvedValue([
        Semester.create({
          id: 's27a',
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
          createdAt: NOW,
          updatedAt: NOW,
        }),
      ]),
    };
    permissionChecker = { assertAllowed: vi.fn().mockResolvedValue(undefined) };
    unitOfWork = { run: vi.fn().mockImplementation((work) => work()) };
    auditLogger = { log: vi.fn().mockResolvedValue(undefined) };
    useCase = new DefineParametersUseCase({
      parameterRepository,
      semesterReader,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'new_id',
      clock: () => NOW,
    });
  });

  it('creates a new version without touching earlier ones and audits before and after', async () => {
    const result = await useCase.execute({
      semesterCode: '2027-I',
      values: [{ key: 'UMBRAL_LOGRADO', value: 15 }],
      actorId: 'admin_1',
    });

    expect(parameterRepository.save).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PARAMETER_CHANGE',
        entity: 'Parameter',
        before: null,
        after: { key: 'UMBRAL_LOGRADO', value: 15, effectiveFrom: '2027-I' },
      }),
    );
    const umbral = result.items.find((item) => item.key === 'UMBRAL_LOGRADO');
    expect(umbral?.value).toBe(15);
    expect(umbral?.versions.map((v) => v.value)).toEqual([14, 15]);
  });

  it('rejects unbalanced weights without persisting or auditing', async () => {
    await expect(
      useCase.execute({
        semesterCode: '2027-I',
        values: [
          { key: 'PESO_DIRECTA', value: 70 },
          { key: 'PESO_INDIRECTA', value: 40 },
        ],
        actorId: 'admin_1',
      }),
    ).rejects.toBeInstanceOf(InvalidParameterDataError);
    expect(parameterRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('checks the parametro.editar permission before opening the transaction', async () => {
    permissionChecker.assertAllowed = vi.fn().mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({
        semesterCode: '2027-I',
        values: [{ key: 'UMBRAL_LOGRADO', value: 15 }],
        actorId: 'user_1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user_1',
      permission: 'parametro.editar',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(parameterRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects an unknown semester without persisting or auditing', async () => {
    await expect(
      useCase.execute({
        semesterCode: '2099-I',
        values: [{ key: 'UMBRAL_LOGRADO', value: 15 }],
        actorId: 'admin_1',
      }),
    ).rejects.toBeInstanceOf(ParameterSemesterNotFoundError);
    expect(parameterRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('locks and lists the versions inside the transaction', async () => {
    await useCase.execute({
      semesterCode: '2027-I',
      values: [{ key: 'META_AG', value: 80 }],
      actorId: 'admin_1',
    });
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(parameterRepository.lockAndListVersions).toHaveBeenCalledTimes(1);
  });

  it('persists the version tied to the semester with the actor and clock', async () => {
    await useCase.execute({
      semesterCode: '2027-I',
      values: [{ key: 'META_AG', value: 80 }],
      actorId: 'admin_1',
      ip: '10.0.0.1',
    });

    const saved = vi.mocked(parameterRepository.save).mock.calls[0]?.[0];
    expect(saved).toMatchObject({
      id: 'new_id',
      key: 'META_AG',
      value: 80,
      effectiveFromSemesterId: 's27a',
      createdBy: 'admin_1',
      updatedBy: 'admin_1',
      createdAt: NOW,
    });
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ actor: 'admin_1', ip: '10.0.0.1', entityId: 'new_id' }),
    );
  });

  it('writes one audit event per changed key', async () => {
    await useCase.execute({
      semesterCode: '2027-I',
      values: [
        { key: 'PESO_DIRECTA', value: 60 },
        { key: 'PESO_INDIRECTA', value: 40 },
        { key: 'TOKEN_DIAS', value: 10 },
      ],
      actorId: 'admin_1',
    });
    expect(parameterRepository.save).toHaveBeenCalledTimes(3);
    expect(auditLogger.log).toHaveBeenCalledTimes(3);
  });

  it('replaces the value of an existing version and audits before and after', async () => {
    vi.mocked(parameterRepository.lockAndListVersions).mockResolvedValue([
      ...DEFAULTS,
      metaVersionFor2027I(80),
    ]);

    const result = await useCase.execute({
      semesterCode: '2027-I',
      values: [{ key: 'META_AG', value: 85 }],
      actorId: 'admin_1',
    });

    const saved = vi.mocked(parameterRepository.save).mock.calls[0]?.[0];
    expect(saved).toMatchObject({ id: 'v_meta', value: 85, createdBy: 'admin_0' });
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'v_meta',
        before: { key: 'META_AG', value: 80 },
        after: { key: 'META_AG', value: 85, effectiveFrom: '2027-I' },
      }),
    );
    const meta = result.items.find((item) => item.key === 'META_AG');
    expect(meta?.versions.map((v) => v.value)).toEqual([70, 85]);
  });

  it('does not save or audit redefining the same value', async () => {
    vi.mocked(parameterRepository.lockAndListVersions).mockResolvedValue([
      ...DEFAULTS,
      metaVersionFor2027I(80),
    ]);

    const result = await useCase.execute({
      semesterCode: '2027-I',
      values: [{ key: 'META_AG', value: 80 }],
      actorId: 'admin_1',
    });

    expect(parameterRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
    expect(result.items.find((item) => item.key === 'META_AG')?.value).toBe(80);
  });

  it.each([
    ['empty values', []],
    [
      'repeated keys',
      [
        { key: 'META_AG', value: 70 },
        { key: 'META_AG', value: 71 },
      ],
    ],
    ['a single weight', [{ key: 'PESO_DIRECTA', value: 70 }]],
    ['value out of range', [{ key: 'UMBRAL_LOGRADO', value: 21 }]],
  ])('rejects %s without persisting or auditing', async (_name, values) => {
    await expect(
      useCase.execute({
        semesterCode: '2027-I',
        values: values as DefineParametersCommand['values'],
        actorId: 'admin_1',
      }),
    ).rejects.toBeInstanceOf(InvalidParameterDataError);
    expect(parameterRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('returns the effective view of the semester, parsed before committing', async () => {
    const result = await useCase.execute({
      semesterCode: '2027-I',
      values: [{ key: 'MIN_PARTICIPACION', value: 5 }],
      actorId: 'admin_1',
    });

    expect(result.semesterCode).toBe('2027-I');
    expect(result.items).toHaveLength(7);
    const min = result.items.find((item) => item.key === 'MIN_PARTICIPACION');
    expect(min).toMatchObject({ value: 5, effectiveFromSemesterCode: '2027-I' });
    const other = result.items.find((item) => item.key === 'TOKEN_DIAS');
    expect(other).toMatchObject({ value: 7, effectiveFromSemesterCode: null });
  });

  it('propagates a repository failure without writing the audit event', async () => {
    vi.mocked(parameterRepository.save).mockRejectedValue(new Error('db down'));

    await expect(
      useCase.execute({
        semesterCode: '2027-I',
        values: [{ key: 'META_AG', value: 80 }],
        actorId: 'admin_1',
      }),
    ).rejects.toThrow('db down');
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
