import { describe, expect, it } from 'vitest';
import {
  assertCatalogVersionAllowed,
  requiredCatalogVersionStatus,
} from './process-catalog-version-rule.js';
import { CatalogVersionNotAllowedError } from '../errors/catalog-version-not-allowed-error.js';

const PROGRAM_ID = 'prog-1';

describe('process-catalog-version-rule', () => {
  it('requires the version under validation for P611, P613 and P621', () => {
    for (const type of ['P611', 'P613', 'P621'] as const) {
      expect(requiredCatalogVersionStatus(type)).toBe('IN_VALIDATION');

      expect(() =>
        assertCatalogVersionAllowed(
          type,
          { id: 'cv-val', programId: PROGRAM_ID, status: 'IN_VALIDATION' },
          PROGRAM_ID,
        ),
      ).not.toThrow();

      for (const wrongStatus of ['DRAFT', 'APPROVED', 'HISTORICAL'] as const) {
        expect(() =>
          assertCatalogVersionAllowed(
            type,
            { id: 'cv-other', programId: PROGRAM_ID, status: wrongStatus },
            PROGRAM_ID,
          ),
        ).toThrow(CatalogVersionNotAllowedError);
      }
    }
  });

  it('requires the current version for P612, P622 and P623', () => {
    for (const type of ['P612', 'P622', 'P623'] as const) {
      expect(requiredCatalogVersionStatus(type)).toBe('APPROVED');

      expect(() =>
        assertCatalogVersionAllowed(
          type,
          { id: 'cv-app', programId: PROGRAM_ID, status: 'APPROVED' },
          PROGRAM_ID,
        ),
      ).not.toThrow();

      for (const wrongStatus of ['DRAFT', 'IN_VALIDATION', 'HISTORICAL'] as const) {
        expect(() =>
          assertCatalogVersionAllowed(
            type,
            { id: 'cv-other', programId: PROGRAM_ID, status: wrongStatus },
            PROGRAM_ID,
          ),
        ).toThrow(CatalogVersionNotAllowedError);
      }
    }
  });

  it('rejects a version of another program', () => {
    expect(() =>
      assertCatalogVersionAllowed(
        'P612',
        { id: 'cv-foreign', programId: 'prog-2', status: 'APPROVED' },
        PROGRAM_ID,
      ),
    ).toThrow(CatalogVersionNotAllowedError);
  });
});
