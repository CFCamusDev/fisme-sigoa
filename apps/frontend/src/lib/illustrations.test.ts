import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ILLUSTRATION_NAMES, ILLUSTRATIONS, type IllustrationName } from './illustrations';

describe('Illustrations assets and mapping (T-077-08a)', () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const illustrationsDir = path.resolve(currentDir, '../assets/illustrations');

  it('exposes all 7 expected illustration keys in ILLUSTRATION_NAMES', () => {
    const expectedKeys: IllustrationName[] = [
      'empty',
      'noResults',
      'error',
      'notFound',
      'noPermission',
      'surveyFinished',
      'linkExpired',
    ];
    expect(ILLUSTRATION_NAMES).toEqual(expectedKeys);
  });

  it('provides a valid asset URL for every entry in ILLUSTRATIONS', () => {
    for (const name of ILLUSTRATION_NAMES) {
      const url = ILLUSTRATIONS[name];
      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    }
  });

  it('matches all physical svg files in src/assets/illustrations', () => {
    const files = fs.readdirSync(illustrationsDir).filter((file) => file.endsWith('.svg'));

    expect(files.length).toBe(7);

    // Mapeo entre nombres de archivo y claves
    const fileToKeyMap: Record<string, IllustrationName> = {
      'empty.svg': 'empty',
      'no-results.svg': 'noResults',
      'error.svg': 'error',
      'not-found.svg': 'notFound',
      'no-permission.svg': 'noPermission',
      'survey-finished.svg': 'surveyFinished',
      'link-expired.svg': 'linkExpired',
    };

    for (const file of files) {
      const key = fileToKeyMap[file];
      expect(key, `Physical file ${file} must have a mapping key`).toBeDefined();
      if (key) {
        expect(ILLUSTRATIONS[key]).toBeDefined();
      }
    }
  });
});
