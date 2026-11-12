import { describe, expect, it } from 'vitest';
import { Parameter } from '../entities/parameter.js';
import { Semester } from '../entities/semester.js';
import type { ParameterReader, ParameterVersion } from '../ports/parameter-reader.js';
import type { SemesterReader } from '../ports/semester-reader.js';
import { ParameterNotConfiguredError, ParameterSemesterNotFoundError } from '../errors/index.js';
import { ParameterResolver } from './parameter-resolver.js';

const NOW = new Date('2026-11-10T10:00:00.000Z');

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
const S2028_I = { id: 's28a', code: '2028-I', startDate: '2028-03-01' };

const semesters = [
  semester('s26b', '2026-II', '2026-08-01', '2026-12-31'),
  semester('s27a', '2027-I', '2027-03-01', '2027-07-31'),
  semester('s27b', '2027-II', '2027-08-01', '2027-12-31'),
  semester('s28a', '2028-I', '2028-03-01', '2028-07-31'),
];
const semesterReader: SemesterReader = { list: () => Promise.resolve(semesters) };

function resolverWith(versions: ParameterVersion[]): ParameterResolver {
  const parameterReader: ParameterReader = { listVersions: () => Promise.resolve(versions) };
  return new ParameterResolver({ parameterReader, semesterReader });
}

const defaults = [
  version('d1', 'UMBRAL_LOGRADO', 14, null),
  version('d2', 'META_AG', 70, null),
  version('d3', 'PESO_DIRECTA', 70, null),
  version('d4', 'PESO_INDIRECTA', 30, null),
  version('d5', 'MIN_PARTICIPACION', 3, null),
  version('d6', 'TOKEN_DIAS', 7, null),
  version('d7', 'LOGIN_INTENTOS', 5, null),
];

describe('ParameterResolver (T-011-03, RF-011)', () => {
  it('resolves the latest version starting at or before the semester', async () => {
    const resolver = resolverWith([...defaults, version('v1', 'UMBRAL_LOGRADO', 15, S2027_I)]);
    await expect(resolver.resolve('UMBRAL_LOGRADO', '2027-I')).resolves.toBe(15);
    await expect(resolver.resolve('UMBRAL_LOGRADO', '2026-II')).resolves.toBe(14);
  });

  it('resolves the seven defaults when no version exists', async () => {
    const all = await resolverWith(defaults).resolveAll('2027-I');
    expect(all).toEqual({
      UMBRAL_LOGRADO: 14,
      META_AG: 70,
      PESO_DIRECTA: 70,
      PESO_INDIRECTA: 30,
      MIN_PARTICIPACION: 3,
      TOKEN_DIAS: 7,
      LOGIN_INTENTOS: 5,
    });
  });

  it('keeps earlier semesters on the old value after a new version', async () => {
    const resolver = resolverWith([...defaults, version('v1', 'META_AG', 80, S2027_I)]);
    await expect(resolver.resolve('META_AG', '2026-II')).resolves.toBe(70);
    await expect(resolver.resolve('META_AG', '2027-I')).resolves.toBe(80);
  });

  it('applies a version to later semesters that have no version of their own', async () => {
    const resolver = resolverWith([...defaults, version('v1', 'META_AG', 80, S2027_I)]);
    await expect(resolver.resolve('META_AG', '2027-II')).resolves.toBe(80);
    await expect(resolver.resolve('META_AG', '2028-I')).resolves.toBe(80);
  });

  it('picks the closest earlier version among several, whatever the list order', async () => {
    const versions = [
      version('v2', 'META_AG', 90, S2028_I),
      ...defaults,
      version('v1', 'META_AG', 80, S2027_I),
    ];
    const resolver = resolverWith(versions);
    await expect(resolver.resolve('META_AG', '2026-II')).resolves.toBe(70);
    await expect(resolver.resolve('META_AG', '2027-II')).resolves.toBe(80);
    await expect(resolver.resolve('META_AG', '2028-I')).resolves.toBe(90);
  });

  it('does not mix versions of different keys', async () => {
    const resolver = resolverWith([...defaults, version('v1', 'META_AG', 80, S2027_I)]);
    await expect(resolver.resolve('UMBRAL_LOGRADO', '2027-I')).resolves.toBe(14);
  });

  it('rejects a semester that does not exist', async () => {
    const resolver = resolverWith(defaults);
    await expect(resolver.resolve('META_AG', '2099-I')).rejects.toBeInstanceOf(
      ParameterSemesterNotFoundError,
    );
    await expect(resolver.resolveAll('2099-I')).rejects.toBeInstanceOf(
      ParameterSemesterNotFoundError,
    );
  });

  it('fails when the default value is missing', async () => {
    const resolver = resolverWith(defaults.filter((item) => item.parameter.key !== 'TOKEN_DIAS'));
    await expect(resolver.resolve('TOKEN_DIAS', '2027-I')).rejects.toBeInstanceOf(
      ParameterNotConfiguredError,
    );
    await expect(resolver.resolveAll('2027-I')).rejects.toBeInstanceOf(ParameterNotConfiguredError);
  });

  it('resolveAt uses the latest semester started on or before the day', async () => {
    const resolver = resolverWith([...defaults, version('v1', 'META_AG', 80, S2027_I)]);
    // Entre 2026-II (termina 2026-12-31) y 2027-I (inicia 2027-03-01): rige 2026-II.
    expect((await resolver.resolveAt('2027-01-15')).META_AG).toBe(70);
    expect((await resolver.resolveAt('2027-03-01')).META_AG).toBe(80);
    expect((await resolver.resolveAt('2027-06-30')).META_AG).toBe(80);
  });

  it('resolveAt returns only the defaults before the first semester', async () => {
    const resolver = resolverWith([...defaults, version('v1', 'META_AG', 80, S2027_I)]);
    expect((await resolver.resolveAt('2020-01-01')).META_AG).toBe(70);
  });
});
