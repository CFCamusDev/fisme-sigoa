import { describe, expect, it } from 'vitest';
import { deriveVersionValidity, type CatalogValidityVersion } from './catalog-version-validity.js';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function version(
  id: string,
  number: number,
  status: CatalogValidityVersion['status'],
  approvedAts: Date[] = [],
): CatalogValidityVersion {
  return { id, number, status, approvedAts };
}

describe('deriveVersionValidity (HU-017, CA2, D4)', () => {
  it('derives validity from the approved resolution and the next activation', () => {
    const versions = [
      version('v1', 1, 'HISTORICAL', [d('2024-03-01')]),
      version('v2', 2, 'APPROVED', [d('2026-05-10')]),
    ];

    expect(deriveVersionValidity('v1', versions)).toEqual({
      validFrom: d('2024-03-01'),
      validUntil: d('2026-05-10'),
    });
  });

  it('gives the current version a start date and no end date', () => {
    const versions = [
      version('v1', 1, 'HISTORICAL', [d('2024-03-01')]),
      version('v2', 2, 'APPROVED', [d('2026-05-10')]),
    ];

    expect(deriveVersionValidity('v2', versions)).toEqual({
      validFrom: d('2026-05-10'),
      validUntil: null,
    });
  });

  it('returns null dates for a version without resolutions', () => {
    const versions = [version('v1', 1, 'APPROVED')];

    expect(deriveVersionValidity('v1', versions)).toEqual({ validFrom: null, validUntil: null });
  });

  it('starts at the earliest approval when the OE and AG resolutions differ', () => {
    const versions = [version('v1', 1, 'APPROVED', [d('2026-06-02'), d('2026-05-20')])];

    expect(deriveVersionValidity('v1', versions).validFrom).toEqual(d('2026-05-20'));
  });

  it('has no end date when a historical version has no activated successor', () => {
    const versions = [version('v1', 1, 'HISTORICAL', [d('2024-03-01')]), version('v2', 2, 'DRAFT')];

    expect(deriveVersionValidity('v1', versions)).toEqual({
      validFrom: d('2024-03-01'),
      validUntil: null,
    });
  });

  it('ends at the activation of the nearest later version that was activated', () => {
    const versions = [
      version('v1', 1, 'HISTORICAL', [d('2023-01-10')]),
      version('v2', 2, 'DRAFT'),
      version('v3', 3, 'APPROVED', [d('2026-02-01')]),
    ];

    expect(deriveVersionValidity('v1', versions).validUntil).toEqual(d('2026-02-01'));
  });

  it('returns null dates for an unknown version', () => {
    expect(deriveVersionValidity('zzz', [version('v1', 1, 'APPROVED')])).toEqual({
      validFrom: null,
      validUntil: null,
    });
  });
});
