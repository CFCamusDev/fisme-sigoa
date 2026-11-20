import { ANNEX_CATALOG } from '@sigoa/shared';
import { describe, expect, it } from 'vitest';
import { OFFICIAL_TEMPLATES } from './template-seed-data.js';

describe('ANNEX_CATALOG drift check (T-070-08)', () => {
  it('matches the seeded annex templates by code and name', () => {
    const seededAnnexes = OFFICIAL_TEMPLATES.filter((template) => template.type === 'ANNEX').map(
      (template) => ({
        code: template.code,
        name: template.name,
      }),
    );

    const catalogAnnexes = ANNEX_CATALOG.map((entry) => ({
      code: entry.code,
      name: entry.name,
    }));

    expect(catalogAnnexes).toEqual(seededAnnexes);
  });
});
