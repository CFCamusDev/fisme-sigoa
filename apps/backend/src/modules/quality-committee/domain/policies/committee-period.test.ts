import { describe, expect, it } from 'vitest';
import { InvalidQualityCommitteeDataError } from '../errors/invalid-quality-committee-data-error.js';
import { assertValidPeriod, isInForce, periodsOverlap, todayInLima } from './committee-period.js';

describe('committee-period', () => {
  it('accepts a valid period including a single-day period', () => {
    expect(assertValidPeriod('2027-01-01', '2027-12-31')).toEqual({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
    });

    expect(assertValidPeriod('2027-06-15', '2027-06-15')).toEqual({
      periodStart: '2027-06-15',
      periodEnd: '2027-06-15',
    });
  });

  it('rejects a start after the end', () => {
    expect(() => assertValidPeriod('2027-12-31', '2027-01-01')).toThrow(
      InvalidQualityCommitteeDataError,
    );
  });

  it('rejects invalid calendar dates or out-of-range years', () => {
    expect(() => assertValidPeriod('2027-02-29', '2027-12-31')).toThrow(
      InvalidQualityCommitteeDataError,
    );
    expect(() => assertValidPeriod('1999-01-01', '2027-12-31')).toThrow(
      InvalidQualityCommitteeDataError,
    );
    expect(() => assertValidPeriod('2027-01-01', '2101-01-01')).toThrow(
      InvalidQualityCommitteeDataError,
    );
    expect(() => assertValidPeriod('01/01/2027', '2027-12-31')).toThrow(
      InvalidQualityCommitteeDataError,
    );
  });

  it('detects overlapping periods inclusively', () => {
    const base = { periodStart: '2027-01-01', periodEnd: '2027-12-31' };

    expect(periodsOverlap(base, { periodStart: '2027-12-31', periodEnd: '2028-12-31' })).toBe(true);
    expect(periodsOverlap(base, { periodStart: '2026-01-01', periodEnd: '2027-01-01' })).toBe(true);
    expect(periodsOverlap(base, { periodStart: '2027-03-01', periodEnd: '2027-06-30' })).toBe(true);
  });

  it('accepts adjacent periods', () => {
    const first = { periodStart: '2027-01-01', periodEnd: '2027-12-31' };
    const next = { periodStart: '2028-01-01', periodEnd: '2028-12-31' };

    expect(periodsOverlap(first, next)).toBe(false);
    expect(periodsOverlap(next, first)).toBe(false);
  });

  it('treats today in Lima as the reference date', () => {
    // 2027-01-01T04:59:59Z is still 2026-12-31 23:59:59 in America/Lima (UTC-5)
    expect(todayInLima(new Date('2027-01-01T04:59:59.000Z'))).toBe('2026-12-31');
    // 2027-01-01T05:00:00Z is already 2027-01-01 00:00:00 in America/Lima (UTC-5)
    expect(todayInLima(new Date('2027-01-01T05:00:00.000Z'))).toBe('2027-01-01');
  });

  it('decides if a period is in force on its first and last day', () => {
    const period = { periodStart: '2027-01-01', periodEnd: '2027-12-31' };

    expect(isInForce(period, '2026-12-31')).toBe(false);
    expect(isInForce(period, '2027-01-01')).toBe(true);
    expect(isInForce(period, '2027-07-15')).toBe(true);
    expect(isInForce(period, '2027-12-31')).toBe(true);
    expect(isInForce(period, '2028-01-01')).toBe(false);
  });
});
