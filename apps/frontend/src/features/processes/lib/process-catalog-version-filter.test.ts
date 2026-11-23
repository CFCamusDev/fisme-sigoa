import { describe, expect, it } from 'vitest';
import { SAMPLE_CATALOG_VERSIONS } from '../test/process-executions-fixtures';
import {
  filterEligibleCatalogVersions,
  requiresValidationVersion,
} from './process-catalog-version-filter';

describe('process-catalog-version-filter (HU-081, T-081-08)', () => {
  it('identifies validation processes that require IN_VALIDATION versions', () => {
    expect(requiresValidationVersion('P611')).toBe(true);
    expect(requiresValidationVersion('P613')).toBe(true);
    expect(requiresValidationVersion('P621')).toBe(true);
    expect(requiresValidationVersion('P612')).toBe(false);
    expect(requiresValidationVersion('P622')).toBe(false);
    expect(requiresValidationVersion('P623')).toBe(false);
    expect(requiresValidationVersion('')).toBe(false);
  });

  it('returns only eligible versions for each process type', () => {
    expect(filterEligibleCatalogVersions('', SAMPLE_CATALOG_VERSIONS)).toEqual([]);
    expect(
      filterEligibleCatalogVersions('P611', SAMPLE_CATALOG_VERSIONS).map((v) => v.status),
    ).toEqual(['IN_VALIDATION']);
    expect(
      filterEligibleCatalogVersions('P612', SAMPLE_CATALOG_VERSIONS).map((v) => v.status),
    ).toEqual(['APPROVED']);
  });
});
