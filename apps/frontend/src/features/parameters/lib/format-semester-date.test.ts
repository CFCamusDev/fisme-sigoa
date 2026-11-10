import { describe, expect, it } from 'vitest';
import { formatSemesterDate } from './format-semester-date';

describe('formatSemesterDate (unit tests, D5, AGENTS §4.3)', () => {
  it('formats YYYY-MM-DD as dd/mm/aaaa without timezone shift', () => {
    expect(formatSemesterDate('2027-03-01')).toBe('01/03/2027');
    expect(formatSemesterDate('2027-07-31')).toBe('31/07/2027');
    expect(formatSemesterDate('2027-12-31')).toBe('31/12/2027');
    expect(formatSemesterDate('2028-02-29')).toBe('29/02/2028');
  });

  it('handles empty or malformed strings gracefully', () => {
    expect(formatSemesterDate('')).toBe('');
    expect(formatSemesterDate('invalid-date')).toBe('invalid-date');
  });
});
