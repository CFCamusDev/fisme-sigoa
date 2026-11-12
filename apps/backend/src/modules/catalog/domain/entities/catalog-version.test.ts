import { describe, expect, it } from 'vitest';
import { CatalogVersion } from './catalog-version.js';

describe('CatalogVersion', () => {
  it('is born as a draft linked to its source version', () => {
    const version = CatalogVersion.createDraft({
      id: 'v2',
      programId: 'p1',
      number: 2,
      basedOnVersionId: 'v1',
    });
    expect(version.status).toBe('DRAFT');
    expect(version.basedOnVersionId).toBe('v1');
    expect(version.isOpen()).toBe(true);
  });
});
