import { describe, expect, it } from 'vitest';
import { Parameter } from '../entities/parameter.js';
import { Semester } from '../entities/semester.js';
import type { ParameterReader, ParameterVersion } from '../ports/parameter-reader.js';
import type { SemesterReader } from '../ports/semester-reader.js';
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

const semesters = [
  semester('s26b', '2026-II', '2026-08-01', '2026-12-31'),
  semester('s27a', '2027-I', '2027-03-01', '2027-07-31'),
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
});
