import { describe, expect, it } from 'vitest';
import {
  createSemesterRequestSchema,
  listSemestersQuerySchema,
  listSemestersResponseSchema,
  semesterCodeSchema,
  semesterDateSchema,
  semesterDtoSchema,
  SEMESTER_CODE_PATTERN,
} from './semester.js';

describe('Semester Schemas (@sigoa/shared, T-010-06, RF-010, RNF-008)', () => {
  describe('semesterCodeSchema (CA3)', () => {
    it('accepts valid semester codes', () => {
      expect(semesterCodeSchema.parse('2027-I')).toBe('2027-I');
      expect(semesterCodeSchema.parse('2027-II')).toBe('2027-II');
      expect(semesterCodeSchema.parse('  2028-I  ')).toBe('2028-I');
    });

    it.each(['2027-III', '2027-i', '27-I', '2027_I', '2027-1', '', '   ', '2027-I-extra', 'abc'])(
      'rejects invalid code %s with expected CA3 error message',
      (invalidCode) => {
        const result = semesterCodeSchema.safeParse(invalidCode);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe(
            'El código del semestre debe tener el formato AAAA-I o AAAA-II (por ejemplo, 2027-I)',
          );
        }
      },
    );

    it('matches the exact regular expression pattern', () => {
      expect(SEMESTER_CODE_PATTERN.test('2027-I')).toBe(true);
      expect(SEMESTER_CODE_PATTERN.test('2027-II')).toBe(true);
      expect(SEMESTER_CODE_PATTERN.test('2027-III')).toBe(false);
    });
  });

  describe('semesterDateSchema', () => {
    it('accepts real calendar dates', () => {
      expect(semesterDateSchema.parse('2027-03-01')).toBe('2027-03-01');
      expect(semesterDateSchema.parse('2028-02-29')).toBe('2028-02-29'); // Leap year
    });

    it.each([
      '2027-02-29', // Non-leap year
      '2027-02-30',
      '2027-04-31',
      '2027-13-01',
      '2027-00-10',
      '01/03/2027',
      '2027-03-01T00:00:00Z',
      'invalid-date',
    ])('rejects invalid calendar date %s', (invalidDate) => {
      const result = semesterDateSchema.safeParse(invalidDate);
      expect(result.success).toBe(false);
    });
  });

  describe('createSemesterRequestSchema', () => {
    const validPayload = {
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
    };

    it('parses valid request payload', () => {
      const parsed = createSemesterRequestSchema.parse(validPayload);
      expect(parsed).toEqual(validPayload);
    });

    it('rejects when startDate is equal to endDate', () => {
      const result = createSemesterRequestSchema.safeParse({
        ...validPayload,
        endDate: '2027-03-01',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'La fecha de inicio debe ser anterior a la fecha de fin.',
        );
      }
    });

    it('rejects when startDate is after endDate', () => {
      const result = createSemesterRequestSchema.safeParse({
        ...validPayload,
        startDate: '2027-08-01',
        endDate: '2027-07-31',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'La fecha de inicio debe ser anterior a la fecha de fin.',
        );
      }
    });

    it('rejects unknown fields (.strict violation)', () => {
      const result = createSemesterRequestSchema.safeParse({
        ...validPayload,
        extraField: 'hostile-input',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('semesterDtoSchema', () => {
    const validDto = {
      id: 'sem_cuid_123',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      updatedAt: '2026-11-09T12:00:00.000Z',
    };

    it('parses valid semester DTO', () => {
      expect(semesterDtoSchema.parse(validDto)).toEqual(validDto);
    });

    it('rejects missing or empty id', () => {
      expect(semesterDtoSchema.safeParse({ ...validDto, id: '' }).success).toBe(false);
    });

    it('rejects non-ISO datetime in updatedAt', () => {
      expect(semesterDtoSchema.safeParse({ ...validDto, updatedAt: 'not-iso' }).success).toBe(
        false,
      );
    });

    it('rejects unknown extra fields', () => {
      expect(semesterDtoSchema.safeParse({ ...validDto, createdBy: 'admin' }).success).toBe(false);
    });
  });

  describe('listSemestersQuerySchema and listSemestersResponseSchema', () => {
    it('accepts empty query and rejects extra parameters', () => {
      expect(listSemestersQuerySchema.parse({})).toEqual({});
      expect(listSemestersQuerySchema.safeParse({ search: '2027' }).success).toBe(false);
    });

    it('parses valid list response with multiple items and empty items array', () => {
      const emptyResponse = listSemestersResponseSchema.parse({ items: [] });
      expect(emptyResponse.items).toEqual([]);

      const response = listSemestersResponseSchema.parse({
        items: [
          {
            id: 'sem_1',
            code: '2027-I',
            startDate: '2027-03-01',
            endDate: '2027-07-31',
            updatedAt: '2026-11-09T10:00:00.000Z',
          },
        ],
      });
      expect(response.items).toHaveLength(1);
    });
  });
});
