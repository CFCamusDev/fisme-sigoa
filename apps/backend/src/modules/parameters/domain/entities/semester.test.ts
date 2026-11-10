import { describe, expect, it } from 'vitest';
import { Semester } from './semester.js';
import { assertSemesterFitsSchedule } from '../policies/semester-schedule.js';
import {
  InvalidSemesterDataError,
  SemesterCodeAlreadyExistsError,
  SemesterOverlapError,
} from '../errors/index.js';

describe('Semester entity and policy (T-010-02, RF-010)', () => {
  const baseValidProps = {
    id: 'sem_1',
    code: '2027-I',
    startDate: '2027-03-01',
    endDate: '2027-07-31',
    createdBy: 'user_1',
    updatedBy: null,
    createdAt: new Date('2026-11-09T00:00:00.000Z'),
    updatedAt: new Date('2026-11-09T00:00:00.000Z'),
  };

  it('creates a valid semester', () => {
    const semester = Semester.create(baseValidProps);
    expect(semester.id).toBe('sem_1');
    expect(semester.code).toBe('2027-I');
    expect(semester.startDate).toBe('2027-03-01');
    expect(semester.endDate).toBe('2027-07-31');
  });

  it('rejects codes outside the YYYY-I/II format with expected format message (CA3)', () => {
    expect(() => Semester.create({ ...baseValidProps, code: '2027-III' })).toThrow(
      InvalidSemesterDataError,
    );
    expect(() => Semester.create({ ...baseValidProps, code: '2027-III' })).toThrow(
      'El código del semestre debe tener el formato AAAA-I o AAAA-II (por ejemplo, 2027-I)',
    );
  });

  it('rejects overlapping ranges including shared boundary days (CA2)', () => {
    const sem1 = Semester.create(baseValidProps);
    const candidateOverlapping = Semester.create({
      ...baseValidProps,
      id: 'sem_2',
      code: '2027-II',
      startDate: '2027-07-31', // comparte el último día de sem1
      endDate: '2027-12-31',
    });

    expect(() => assertSemesterFitsSchedule(candidateOverlapping, [sem1])).toThrow(
      SemesterOverlapError,
    );
  });

  it('rejects duplicate semester code', () => {
    const sem1 = Semester.create(baseValidProps);
    const candidateDuplicate = Semester.create({
      ...baseValidProps,
      id: 'sem_2',
      code: '2027-I',
      startDate: '2028-03-01',
      endDate: '2028-07-31',
    });

    expect(() => assertSemesterFitsSchedule(candidateDuplicate, [sem1])).toThrow(
      SemesterCodeAlreadyExistsError,
    );
  });
});
