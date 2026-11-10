import { describe, expect, it } from 'vitest';
import { Semester } from './semester.js';
import { assertSemesterFitsSchedule } from '../policies/semester-schedule.js';
import {
  InvalidSemesterDataError,
  SemesterCodeAlreadyExistsError,
  SemesterOverlapError,
} from '../errors/index.js';

describe('Semester entity and domain policies (T-010-12, RF-010)', () => {
  const baseValidProps = {
    id: 'sem_base',
    code: '2027-I',
    startDate: '2027-03-01',
    endDate: '2027-07-31',
    createdBy: 'admin_1',
    updatedBy: null,
    createdAt: new Date('2026-11-09T10:00:00.000Z'),
    updatedAt: new Date('2026-11-09T10:00:00.000Z'),
  };

  describe('Semester Code Validation (CA3, RF-010)', () => {
    it('accepts valid semester codes and normalizes surrounding whitespace', () => {
      const semI = Semester.create({ ...baseValidProps, code: '  2027-I  ' });
      expect(semI.code).toBe('2027-I');

      const semII = Semester.create({
        ...baseValidProps,
        id: 'sem_2',
        code: '2027-II',
        startDate: '2027-08-01',
        endDate: '2027-12-31',
      });
      expect(semII.code).toBe('2027-II');
    });

    it.each([
      ['2027-III', 'roman numeral outside I/II'],
      ['2027-i', 'lowercase roman numeral'],
      ['27-I', 'two-digit year'],
      ['2027_I', 'underscore separator instead of dash'],
      ['2027-1', 'arabic number instead of roman numeral'],
      ['', 'empty string'],
      ['   ', 'whitespace only'],
      ['2027-I-extra', 'trailing characters'],
      [`2027-I${'A'.repeat(5000)}`, 'oversized hostile string'],
    ])('rejects invalid code %s (%s) with expected CA3 message', (invalidCode) => {
      expect(() => Semester.create({ ...baseValidProps, code: invalidCode })).toThrow(
        InvalidSemesterDataError,
      );
      expect(() => Semester.create({ ...baseValidProps, code: invalidCode })).toThrow(
        'El código del semestre debe tener el formato AAAA-I o AAAA-II (por ejemplo, 2027-I)',
      );
    });
  });

  describe('Calendar Date and Chronology Validation (RF-010, D2)', () => {
    it('accepts valid leap year day (2028-02-29)', () => {
      const leapSemester = Semester.create({
        ...baseValidProps,
        code: '2028-I',
        startDate: '2028-02-01',
        endDate: '2028-02-29',
      });
      expect(leapSemester.startDate).toBe('2028-02-01');
      expect(leapSemester.endDate).toBe('2028-02-29');
    });

    it.each([
      ['2027-02-29', '2027-07-31', 'non-leap year February 29th'],
      ['2027-02-30', '2027-07-31', 'February 30th'],
      ['2027-04-31', '2027-07-31', 'April 31st (month with 30 days)'],
      ['2027-13-01', '2027-07-31', 'invalid month 13'],
      ['2027-00-15', '2027-07-31', 'invalid month 00'],
      ['2027-03-00', '2027-07-31', 'invalid day 00'],
      ['2027-03-32', '2027-07-31', 'invalid day 32'],
      ['01/03/2027', '2027-07-31', 'slash format instead of dash'],
      ['2027-03-01T00:00:00Z', '2027-07-31', 'ISO date with time component'],
      ['2027-03-01', '2027-02-29', 'invalid endDate in non-leap year'],
    ])('rejects non-calendar dates: start=%s end=%s (%s)', (start, end) => {
      expect(() => Semester.create({ ...baseValidProps, startDate: start, endDate: end })).toThrow(
        InvalidSemesterDataError,
      );
    });

    it('rejects when startDate is equal to endDate', () => {
      expect(() =>
        Semester.create({
          ...baseValidProps,
          startDate: '2027-03-01',
          endDate: '2027-03-01',
        }),
      ).toThrow('La fecha de inicio debe ser anterior a la fecha de fin.');
    });

    it('rejects when startDate is after endDate', () => {
      expect(() =>
        Semester.create({
          ...baseValidProps,
          startDate: '2027-07-31',
          endDate: '2027-03-01',
        }),
      ).toThrow('La fecha de inicio debe ser anterior a la fecha de fin.');
    });

    it('exposes all getters correctly', () => {
      const sem = Semester.create(baseValidProps);
      expect(sem.id).toBe('sem_base');
      expect(sem.code).toBe('2027-I');
      expect(sem.startDate).toBe('2027-03-01');
      expect(sem.endDate).toBe('2027-07-31');
      expect(sem.createdBy).toBe('admin_1');
      expect(sem.updatedBy).toBeNull();
      expect(sem.createdAt).toEqual(new Date('2026-11-09T10:00:00.000Z'));
      expect(sem.updatedAt).toEqual(new Date('2026-11-09T10:00:00.000Z'));
    });
  });

  describe('Schedule Overlap Policy assertSemesterFitsSchedule (CA2, RF-010)', () => {
    const existingSemester = Semester.create({
      id: 'sem_existing',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('accepts strictly consecutive semesters that do not share any day', () => {
      const nextSemester = Semester.create({
        id: 'sem_next',
        code: '2027-II',
        startDate: '2027-08-01', // día siguiente al 2027-07-31
        endDate: '2027-12-31',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => assertSemesterFitsSchedule(nextSemester, [existingSemester])).not.toThrow();
    });

    it('rejects sharing the upper boundary day with existing semester (CA2)', () => {
      const candidate = Semester.create({
        id: 'sem_candidate',
        code: '2027-II',
        startDate: '2027-07-31', // comparte el último día del existente
        endDate: '2027-12-31',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => assertSemesterFitsSchedule(candidate, [existingSemester])).toThrow(
        SemesterOverlapError,
      );
      expect(() => assertSemesterFitsSchedule(candidate, [existingSemester])).toThrow(
        'El rango de fechas del semestre se superpone con el semestre 2027-I (2027-03-01 a 2027-07-31).',
      );
    });

    it('rejects sharing the lower boundary day with existing semester (CA2)', () => {
      const candidate = Semester.create({
        id: 'sem_prev',
        code: '2026-II',
        startDate: '2026-08-01',
        endDate: '2027-03-01', // comparte el primer día del existente
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => assertSemesterFitsSchedule(candidate, [existingSemester])).toThrow(
        SemesterOverlapError,
      );
    });

    it('rejects candidate entirely contained within existing semester', () => {
      const candidate = Semester.create({
        id: 'sem_inner',
        code: '2027-II',
        startDate: '2027-04-01',
        endDate: '2027-05-31',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => assertSemesterFitsSchedule(candidate, [existingSemester])).toThrow(
        SemesterOverlapError,
      );
    });

    it('rejects candidate that completely wraps around the existing semester', () => {
      const candidate = Semester.create({
        id: 'sem_wrapper',
        code: '2027-II',
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => assertSemesterFitsSchedule(candidate, [existingSemester])).toThrow(
        SemesterOverlapError,
      );
    });

    it('rejects partial overlap on the left boundary', () => {
      const candidate = Semester.create({
        id: 'sem_overlap_left',
        code: '2026-II',
        startDate: '2027-02-15',
        endDate: '2027-04-15',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => assertSemesterFitsSchedule(candidate, [existingSemester])).toThrow(
        SemesterOverlapError,
      );
    });

    it('rejects partial overlap on the right boundary', () => {
      const candidate = Semester.create({
        id: 'sem_overlap_right',
        code: '2027-II',
        startDate: '2027-06-15',
        endDate: '2027-09-15',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => assertSemesterFitsSchedule(candidate, [existingSemester])).toThrow(
        SemesterOverlapError,
      );
    });

    it('rejects duplicate code even if dates do not overlap', () => {
      const candidate = Semester.create({
        id: 'sem_dup_code',
        code: '2027-I', // mismo código
        startDate: '2028-03-01', // fechas distintas
        endDate: '2028-07-31',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => assertSemesterFitsSchedule(candidate, [existingSemester])).toThrow(
        SemesterCodeAlreadyExistsError,
      );
      expect(() => assertSemesterFitsSchedule(candidate, [existingSemester])).toThrow(
        'Ya existe un semestre con el código 2027-I.',
      );
    });

    it('does not compare the candidate against itself when ids match', () => {
      expect(() => assertSemesterFitsSchedule(existingSemester, [existingSemester])).not.toThrow();
    });
  });
});
