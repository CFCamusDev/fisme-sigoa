import { describe, expect, it } from 'vitest';
import {
  formatCommitteeDate,
  formatCommitteePeriod,
  isCommitteeEditable,
  todayInLima,
} from './committee-dates';

describe('committee-dates (T-025-17)', () => {
  it('formats dd/mm/yyyy and period ranges', () => {
    expect(formatCommitteeDate('2027-01-05')).toBe('05/01/2027');
    expect(formatCommitteeDate('2027-12-31')).toBe('31/12/2027');
    expect(formatCommitteePeriod('2027-01-01', '2027-12-31')).toBe('01/01/2027 – 31/12/2027');
  });

  it('hides editing for a finished period using Lima time', () => {
    // 2028-01-01T04:59:59Z is 2027-12-31 23:59:59 in America/Lima
    const still2027InLima = new Date('2028-01-01T04:59:59.000Z');
    // 2028-01-01T05:00:00Z is 2028-01-01 00:00:00 in America/Lima
    const already2028InLima = new Date('2028-01-01T05:00:00.000Z');

    expect(todayInLima(still2027InLima)).toBe('2027-12-31');
    expect(todayInLima(already2028InLima)).toBe('2028-01-01');

    expect(isCommitteeEditable('2027-12-31', still2027InLima)).toBe(true);
    expect(isCommitteeEditable('2027-12-31', already2028InLima)).toBe(false);
    expect(isCommitteeEditable('2028-12-31', already2028InLima)).toBe(true);
  });
});
