import { describe, expect, it } from 'vitest';
import {
  LOGO_ALT_TEXT,
  LOGO_ASSETS_PATH,
  LOGO_VARIANT_NAMES,
  LOGO_VARIANTS,
} from './logo-variants.js';

describe('LOGO_VARIANTS & Brand Assets (T-077-03)', () => {
  it('exposes the institutional alt text', () => {
    expect(LOGO_ALT_TEXT).toBe('Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas');
  });

  it('exposes the base assets path starting with a slash', () => {
    expect(LOGO_ASSETS_PATH).toBe('/assets');
    expect(LOGO_ASSETS_PATH.startsWith('/')).toBe(true);
  });

  it('contains the three required variants with versioned png files', () => {
    expect(LOGO_VARIANT_NAMES).toEqual(['icon', 'square', 'horizontal']);

    for (const variant of LOGO_VARIANT_NAMES) {
      const entry = LOGO_VARIANTS[variant];
      expect(entry).toBeDefined();
      expect(entry.file).toMatch(/^logo-untrm-v\d+-\d+\.png$/);
      expect(entry.size).toBeGreaterThanOrEqual(32);
    }
  });

  it('defines icon as 64px and square as 256px', () => {
    expect(LOGO_VARIANTS.icon.file).toBe('logo-untrm-v1-64.png');
    expect(LOGO_VARIANTS.icon.size).toBe(64);
    expect(LOGO_VARIANTS.square.file).toBe('logo-untrm-v1-256.png');
    expect(LOGO_VARIANTS.square.size).toBe(256);
    expect(LOGO_VARIANTS.horizontal.file).toBe('logo-untrm-v1-256.png');
    expect(LOGO_VARIANTS.horizontal.size).toBe(256);
  });
});
