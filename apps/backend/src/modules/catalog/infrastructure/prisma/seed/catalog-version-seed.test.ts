import { describe, expect, it } from 'vitest';
import { CATALOG_ITEM_LIMITS } from '../../../domain/entities/catalog-limits.js';
import { SEED_ATTRIBUTES, SEED_OBJECTIVES } from './catalog-seed-data.js';

describe('catalog seed data (T-013-11, RN-020)', () => {
  it('has the 4 official objectives OEP1 to OEP4 in order', () => {
    expect(SEED_OBJECTIVES.map((item) => item.code)).toEqual(['OEP1', 'OEP2', 'OEP3', 'OEP4']);
  });

  it('has the 12 official attributes AG-C01 to AG-C12 in order', () => {
    expect(SEED_ATTRIBUTES.map((item) => item.code)).toEqual(
      Array.from({ length: 12 }, (_, index) => `AG-C${String(index + 1).padStart(2, '0')}`),
    );
  });

  it('uses codes that satisfy the domain pattern and are unique', () => {
    const codes = [...SEED_OBJECTIVES, ...SEED_ATTRIBUTES].map((item) => item.code);
    expect(codes.every((code) => CATALOG_ITEM_LIMITS.codeRegex.test(code))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has non-empty texts within the domain limits', () => {
    for (const item of [...SEED_OBJECTIVES, ...SEED_ATTRIBUTES]) {
      expect(item.statement.trim()).toBe(item.statement);
      expect(item.statement.length).toBeGreaterThan(0);
      expect(item.statement.length).toBeLessThanOrEqual(CATALOG_ITEM_LIMITS.statementMaxLength);
    }
    for (const item of SEED_ATTRIBUTES) {
      expect(item.name.trim()).toBe(item.name);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.name.length).toBeLessThanOrEqual(CATALOG_ITEM_LIMITS.nameMaxLength);
    }
  });

  it('keeps the official wording of AG-C12 (not the discarded variant)', () => {
    const c12 = SEED_ATTRIBUTES.find((item) => item.code === 'AG-C12');
    expect(c12?.name).toBe('Entorno de Sistemas de Información');
    expect(SEED_ATTRIBUTES.find((item) => item.code === 'AG-C07')?.name).toBe(
      'Conocimientos de Computación',
    );
  });
});
