import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cn, CUSTOM_FONT_SIZES } from './utils';

describe('cn helper with custom font-size tokens (T-077-06a)', () => {
  it('preserves both custom font-size and text-color classes', () => {
    const result = cn('text-label', 'text-primary-foreground');
    expect(result).toContain('text-label');
    expect(result).toContain('text-primary-foreground');
  });

  it('correctly overrides standard font size when custom font size is applied later', () => {
    const result = cn('text-sm', 'text-label');
    expect(result).toBe('text-label');
  });

  it('correctly merges brand background colors keeping the last one', () => {
    const result = cn('bg-primary', 'bg-brand-200');
    expect(result).toBe('bg-brand-200');
  });

  it('covers all --text-* tokens defined in index.css without dropping color classes', () => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const cssPath = path.resolve(currentDir, '../index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Extrae tokens como --text-h1, --text-label, pero ignora --text-h1--line-height
    const matches = [...cssContent.matchAll(/--text-([a-z0-9]+)(?=[^a-z0-9-]|$)/g)];
    const definedFontSizes = Array.from(new Set(matches.map((m) => m[1])));

    expect(definedFontSizes.length).toBeGreaterThan(0);

    for (const sizeName of definedFontSizes) {
      expect(
        CUSTOM_FONT_SIZES,
        `Token --text-${sizeName} must be registered in CUSTOM_FONT_SIZES in utils.ts`,
      ).toContain(sizeName);

      const merged = cn(`text-${sizeName}`, 'text-primary');
      expect(merged, `cn("text-${sizeName}", "text-primary") must preserve both classes`).toContain(
        `text-${sizeName}`,
      );
      expect(merged).toContain('text-primary');
    }
  });
});
