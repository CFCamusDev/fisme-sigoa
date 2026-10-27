import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, parseDateInput } from './date';

describe('date utilities (es-PE, America/Lima)', () => {
  describe('parseDateInput', () => {
    it('returns null for null, undefined, or empty values', () => {
      expect(parseDateInput(null)).toBeNull();
      expect(parseDateInput(undefined)).toBeNull();
      expect(parseDateInput('')).toBeNull();
      expect(parseDateInput('   ')).toBeNull();
    });

    it('returns null for invalid date strings', () => {
      expect(parseDateInput('invalid-date')).toBeNull();
      expect(parseDateInput('2026-13-45')).toBeNull();
    });

    it('handles Date objects', () => {
      const now = new Date('2026-10-23T15:30:00.000Z');
      const parsed = parseDateInput(now);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.toISOString()).toBe('2026-10-23T15:30:00.000Z');
    });

    it('handles YYYY-MM-DD date-only strings without timezone shift', () => {
      const parsed = parseDateInput('2026-10-23');
      expect(parsed).not.toBeNull();
    });
  });

  describe('formatDate', () => {
    it('returns placeholder "—" for null or undefined input', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
      expect(formatDate('')).toBe('—');
    });

    it('returns placeholder "—" for invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('—');
      expect(formatDate(new Date('invalid'))).toBe('—');
    });

    it('formats a date-only string YYYY-MM-DD as dd/mm/aaaa without previous-day shift', () => {
      expect(formatDate('2026-10-23')).toBe('23/10/2026');
      expect(formatDate('2026-01-05')).toBe('05/01/2026');
    });

    it('formats a Date instance according to America/Lima timezone', () => {
      // 2026-10-24 02:30 UTC corresponds to 2026-10-23 21:30 in America/Lima (UTC-5)
      const dateInLimaEvening = new Date('2026-10-24T02:30:00.000Z');
      expect(formatDate(dateInLimaEvening)).toBe('23/10/2026');

      // 2026-10-24 05:00 UTC corresponds to 2026-10-24 00:00 in America/Lima
      const dateInLimaMidnight = new Date('2026-10-24T05:00:00.000Z');
      expect(formatDate(dateInLimaMidnight)).toBe('24/10/2026');
    });

    it('formats an ISO string in America/Lima timezone', () => {
      expect(formatDate('2026-10-24T02:30:00.000Z')).toBe('23/10/2026');
      expect(formatDate('2026-10-24T05:00:00.000Z')).toBe('24/10/2026');
    });
  });

  describe('formatDateTime', () => {
    it('returns placeholder "—" for null or undefined input', () => {
      expect(formatDateTime(null)).toBe('—');
      expect(formatDateTime(undefined)).toBe('—');
      expect(formatDateTime('')).toBe('—');
    });

    it('returns placeholder "—" for invalid dates', () => {
      expect(formatDateTime('invalid-date')).toBe('—');
      expect(formatDateTime(new Date('invalid'))).toBe('—');
    });

    it('formats a Date instance with 24-hour time in America/Lima timezone', () => {
      // 2026-10-23 20:45 UTC is 15:45 in Lima (UTC-5)
      const dateUtc = new Date('2026-10-23T20:45:00.000Z');
      expect(formatDateTime(dateUtc)).toBe('23/10/2026 15:45');
    });

    it('formats single-digit hours and minutes with leading zeros in 24h format', () => {
      // 2026-10-23 09:05 in Lima -> 14:05 UTC
      const morningUtc = new Date('2026-10-23T14:05:00.000Z');
      expect(formatDateTime(morningUtc)).toBe('23/10/2026 09:05');

      // 2026-10-23 00:00 in Lima -> 05:00 UTC
      const midnightUtc = new Date('2026-10-23T05:00:00.000Z');
      expect(formatDateTime(midnightUtc)).toBe('23/10/2026 00:00');
    });

    it('formats date-only string as dd/mm/aaaa 00:00', () => {
      expect(formatDateTime('2026-10-23')).toBe('23/10/2026 00:00');
    });
  });
});
