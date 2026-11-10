import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { Parameter } from '../domain/entities/parameter.js';
import { Semester } from '../domain/entities/semester.js';
import { ParameterSemesterNotFoundError } from '../domain/errors/index.js';
import type { ParameterReader, ParameterVersion } from '../domain/ports/parameter-reader.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { SemesterReader } from '../domain/ports/semester-reader.js';
import { ListEffectiveParametersUseCase } from './list-effective-parameters.js';

const NOW = new Date('2026-11-10T12:00:00.000Z');

function semester(id: string, code: string, startDate: string, endDate: string): Semester {
  return Semester.create({ id, code, startDate, endDate, createdAt: NOW, updatedAt: NOW });
}

function version(
  id: string,
  key: string,
  value: number,
  sem: { id: string; code: string; startDate: string } | null,
): ParameterVersion {
  return {
    parameter: Parameter.create({
      id,
      key,
      value,
      effectiveFromSemesterId: sem?.id ?? null,
      createdAt: NOW,
      updatedAt: NOW,
    }),
    semesterCode: sem?.code ?? null,
    semesterStartDate: sem?.startDate ?? null,
  };
}

const S2027_I = { id: 's27a', code: '2027-I', startDate: '2027-03-01' };
const S2026_II = { id: 's26b', code: '2026-II', startDate: '2026-08-01' };

const DEFAULTS: ParameterVersion[] = [
  version('d1', 'UMBRAL_LOGRADO', 14, null),
  version('d2', 'META_AG', 70, null),
  version('d3', 'PESO_DIRECTA', 70, null),
  version('d4', 'PESO_INDIRECTA', 30, null),
  version('d5', 'MIN_PARTICIPACION', 3, null),
  version('d6', 'TOKEN_DIAS', 7, null),
  version('d7', 'LOGIN_INTENTOS', 5, null),
];

describe('ListEffectiveParametersUseCase (T-011-06, T-011-17, RF-011)', () => {
  let parameterReader: ParameterReader;
  let semesterReader: SemesterReader;
  let permissionChecker: ParametersPermissionChecker;
  let versions: ParameterVersion[];
  let semesters: Semester[];

  function build(clock: () => Date = () => new Date('2027-04-10T10:00:00.000Z')) {
    return new ListEffectiveParametersUseCase({
      parameterReader,
      semesterReader,
      permissionChecker,
      clock,
    });
  }

  beforeEach(() => {
    versions = [...DEFAULTS];
    semesters = [
      semester('s26b', '2026-II', '2026-08-01', '2026-12-31'),
      semester('s27a', '2027-I', '2027-03-01', '2027-07-31'),
    ];
    parameterReader = { listVersions: vi.fn(async () => versions) };
    semesterReader = { list: vi.fn(async () => semesters) };
    permissionChecker = { assertAllowed: vi.fn().mockResolvedValue(undefined) };
  });

  it('lists the seven defaults when no version exists', async () => {
    const result = await build().execute({ actorId: 'admin_1' });

    expect(result.semesterCode).toBe('2027-I');
    expect(Object.fromEntries(result.items.map((item) => [item.key, item.value]))).toEqual({
      UMBRAL_LOGRADO: 14,
      META_AG: 70,
      PESO_DIRECTA: 70,
      PESO_INDIRECTA: 30,
      MIN_PARTICIPACION: 3,
      TOKEN_DIAS: 7,
      LOGIN_INTENTOS: 5,
    });
    expect(result.items.every((item) => item.effectiveFromSemesterCode === null)).toBe(true);
  });

  it('checks the parametro.ver permission before reading anything', async () => {
    permissionChecker.assertAllowed = vi.fn().mockRejectedValue(new ForbiddenError());

    await expect(build().execute({ actorId: 'user_1' })).rejects.toBeInstanceOf(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user_1',
      permission: 'parametro.ver',
      scope: 'GLOBAL',
    });
    expect(semesterReader.list).not.toHaveBeenCalled();
    expect(parameterReader.listVersions).not.toHaveBeenCalled();
  });

  it('rejects an unknown semester', async () => {
    await expect(
      build().execute({ actorId: 'admin_1', semesterCode: '2099-I' }),
    ).rejects.toBeInstanceOf(ParameterSemesterNotFoundError);
  });

  it('uses the new value only from its semester on and keeps earlier ones (CA2)', async () => {
    versions = [...DEFAULTS, version('v1', 'UMBRAL_LOGRADO', 15, S2027_I)];

    const current = await build().execute({ actorId: 'admin_1' });
    const before = await build().execute({ actorId: 'admin_1', semesterCode: '2026-II' });
    const from = await build().execute({ actorId: 'admin_1', semesterCode: '2027-I' });

    expect(current.items.find((i) => i.key === 'UMBRAL_LOGRADO')?.value).toBe(15);
    expect(before.items.find((i) => i.key === 'UMBRAL_LOGRADO')).toMatchObject({
      value: 14,
      effectiveFromSemesterCode: null,
    });
    expect(from.items.find((i) => i.key === 'UMBRAL_LOGRADO')).toMatchObject({
      value: 15,
      effectiveFromSemesterCode: '2027-I',
    });
  });

  it('derives the end of each version from the next one', async () => {
    versions = [...DEFAULTS, version('v1', 'META_AG', 80, S2027_I)];

    const result = await build().execute({ actorId: 'admin_1' });
    const meta = result.items.find((item) => item.key === 'META_AG');

    expect(meta?.versions).toEqual([
      { value: 70, effectiveFromSemesterCode: null, effectiveToSemesterCode: '2026-II' },
      { value: 80, effectiveFromSemesterCode: '2027-I', effectiveToSemesterCode: null },
    ]);
  });

  it('keeps several versions ordered by start date whatever the reader order', async () => {
    versions = [
      version('v2', 'META_AG', 90, { id: 's27b', code: '2027-II', startDate: '2027-08-01' }),
      ...DEFAULTS,
      version('v1', 'META_AG', 80, S2027_I),
    ];
    semesters.push(semester('s27b', '2027-II', '2027-08-01', '2027-12-31'));

    const result = await build().execute({ actorId: 'admin_1', semesterCode: '2027-II' });
    const meta = result.items.find((item) => item.key === 'META_AG');

    expect(meta?.value).toBe(90);
    expect(meta?.versions.map((v) => v.value)).toEqual([70, 80, 90]);
  });

  it('answers with the defaults and a null semester when no semester has started', async () => {
    const result = await build(() => new Date('2020-01-01T00:00:00.000Z')).execute({
      actorId: 'admin_1',
    });

    expect(result.semesterCode).toBeNull();
    expect(result.items).toHaveLength(7);
    expect(result.items.find((item) => item.key === 'TOKEN_DIAS')?.value).toBe(7);
  });

  it('answers with the defaults when there are no semesters at all', async () => {
    semesters = [];

    const result = await build().execute({ actorId: 'admin_1' });

    expect(result.semesterCode).toBeNull();
    expect(result.items.map((item) => item.value)).toEqual([14, 70, 70, 30, 3, 7, 5]);
  });

  it('picks the last started semester of the clock day, even if it already ended', async () => {
    const result = await build(() => new Date('2027-01-20T00:00:00.000Z')).execute({
      actorId: 'admin_1',
    });
    expect(result.semesterCode).toBe('2026-II');
  });

  it('shows a semester without own versions with the defaults', async () => {
    versions = [...DEFAULTS, version('v0', 'META_AG', 60, S2026_II)];

    const result = await build().execute({ actorId: 'admin_1', semesterCode: '2026-II' });

    expect(result.items.find((item) => item.key === 'META_AG')).toMatchObject({
      value: 60,
      effectiveFromSemesterCode: '2026-II',
    });
    expect(result.items.find((item) => item.key === 'UMBRAL_LOGRADO')?.value).toBe(14);
  });

  it('returns a response that satisfies the public schema', async () => {
    const { parametersResponseSchema } = await import('@sigoa/shared');
    const result = await build().execute({ actorId: 'admin_1', semesterCode: '2027-I' });
    expect(parametersResponseSchema.safeParse(result).success).toBe(true);
  });
});
