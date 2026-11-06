import { describe, expect, it } from 'vitest';
import { formatEmailDateTime } from './format-email-date.js';

describe('formatEmailDateTime (RN-004, RS-005, RS-016)', () => {
  it('formats dates in es-PE and America/Lima (UTC-5) timezone with 24-hour clock', () => {
    // 2026-11-05T19:30:00Z -> 14:30 en Lima
    const utcDate = new Date('2026-11-05T19:30:00.000Z');
    expect(formatEmailDateTime(utcDate)).toBe('05/11/2026 14:30');

    // Medianoche UTC -> 19:00 del día anterior en Lima
    const midnightUtc = new Date('2026-11-06T00:00:00.000Z');
    expect(formatEmailDateTime(midnightUtc)).toBe('05/11/2026 19:00');
  });

  it('zero-pads single-digit days, months, hours and minutes', () => {
    // 2026-03-04T08:05:00Z -> 03:05 en Lima
    const date = new Date('2026-03-04T08:05:00.000Z');
    expect(formatEmailDateTime(date)).toBe('04/03/2026 03:05');
  });
});
