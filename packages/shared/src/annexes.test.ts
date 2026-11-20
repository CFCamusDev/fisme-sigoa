import { describe, expect, it } from 'vitest';
import { ANNEX_CATALOG, ANNEX_CODES, annexCodeParamsSchema } from './annexes.js';

describe('annexes shared contracts (T-070-03)', () => {
  it('accepts the eleven official annex codes', () => {
    for (const code of ANNEX_CODES) {
      const parsed = annexCodeParamsSchema.safeParse({ code });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.code).toBe(code);
      }
    }
  });

  it('rejects unknown codes, empty values and extra properties', () => {
    expect(annexCodeParamsSchema.safeParse({ code: 'FO-12' }).success).toBe(false);
    expect(annexCodeParamsSchema.safeParse({ code: 'fo-01' }).success).toBe(false);
    expect(annexCodeParamsSchema.safeParse({ code: '' }).success).toBe(false);
    expect(annexCodeParamsSchema.safeParse({ code: 'FO-01', extra: 'x' }).success).toBe(false);
  });

  it('lists the eleven annexes in order', () => {
    expect(ANNEX_CATALOG).toHaveLength(11);
    ANNEX_CATALOG.forEach((entry, index) => {
      const expectedNumber = index + 1;
      const expectedCode = `FO-${String(expectedNumber).padStart(2, '0')}`;
      expect(entry.number).toBe(expectedNumber);
      expect(entry.code).toBe(expectedCode);
      expect(entry.name.startsWith(`Anexo ${expectedNumber}. `)).toBe(true);
    });
  });
});
