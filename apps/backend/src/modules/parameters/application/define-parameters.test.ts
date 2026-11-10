import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Parameter } from '../domain/entities/parameter.js';
import { Semester } from '../domain/entities/semester.js';
import { InvalidParameterDataError } from '../domain/errors/index.js';
import type { ParameterVersion } from '../domain/ports/parameter-reader.js';
import type { ParameterRepository } from '../domain/ports/parameter-repository.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { SemesterReader } from '../domain/ports/semester-reader.js';
import { DefineParametersUseCase } from './define-parameters.js';

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

const DEFAULTS: ParameterVersion[] = [
  defaultVersion('d1', 'UMBRAL_LOGRADO', 14),
  defaultVersion('d2', 'META_AG', 70),
  defaultVersion('d3', 'PESO_DIRECTA', 70),
  defaultVersion('d4', 'PESO_INDIRECTA', 30),
  defaultVersion('d5', 'MIN_PARTICIPACION', 3),
  defaultVersion('d6', 'TOKEN_DIAS', 7),
  defaultVersion('d7', 'LOGIN_INTENTOS', 5),
];

describe('DefineParametersUseCase (T-011-05, RF-011, RS-020)', () => {
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
});
