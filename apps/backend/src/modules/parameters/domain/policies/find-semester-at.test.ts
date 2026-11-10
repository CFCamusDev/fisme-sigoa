import { describe, expect, it } from 'vitest';
import { Semester } from '../entities/semester.js';
import { findSemesterAt } from './find-semester-at.js';

const NOW = new Date('2026-11-10T10:00:00.000Z');

function semester(code: string, startDate: string, endDate: string): Semester {
  return Semester.create({ id: code, code, startDate, endDate, createdAt: NOW, updatedAt: NOW });
}

const semesters = [
  semester('2027-I', '2027-03-01', '2027-07-31'),
  semester('2026-II', '2026-08-01', '2026-12-31'),
  semester('2027-II', '2027-08-01', '2027-12-31'),
];

describe('findSemesterAt (T-011-06, RF-011)', () => {
  it('returns the latest semester started on or before the day, whatever the order', () => {
    expect(findSemesterAt(semesters, '2027-09-01')?.code).toBe('2027-II');
    expect(findSemesterAt(semesters, '2027-03-01')?.code).toBe('2027-I');
  });

  it('keeps the last started semester between two semesters', () => {
    expect(findSemesterAt(semesters, '2027-01-15')?.code).toBe('2026-II');
  });

  it('returns null before the first semester and for an empty list', () => {
    expect(findSemesterAt(semesters, '2020-01-01')).toBeNull();
    expect(findSemesterAt([], '2027-01-01')).toBeNull();
  });
});
