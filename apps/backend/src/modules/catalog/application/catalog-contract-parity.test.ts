import {
  CATALOG_CODE_PATTERN,
  CATALOG_NAME_MAX_LENGTH,
  CATALOG_STATEMENT_MAX_LENGTH,
  CATALOG_VERSION_STATUSES as SHARED_STATUSES,
} from '@sigoa/shared';
import { describe, expect, it } from 'vitest';
import { CATALOG_ITEM_LIMITS } from '../domain/entities/catalog-limits.js';
import { CATALOG_VERSION_STATUSES as DOMAIN_STATUSES } from '../domain/entities/catalog-version.js';

describe('catalog contract parity between @sigoa/shared and the domain (T-013-12)', () => {
  it('uses the same version statuses on both sides', () => {
    expect([...SHARED_STATUSES]).toEqual([...DOMAIN_STATUSES]);
  });

  it('uses the same code pattern on both sides', () => {
    expect(CATALOG_CODE_PATTERN.source).toBe(CATALOG_ITEM_LIMITS.codeRegex.source);
  });

  it('uses the same statement and name limits on both sides', () => {
    expect(CATALOG_STATEMENT_MAX_LENGTH).toBe(CATALOG_ITEM_LIMITS.statementMaxLength);
    expect(CATALOG_NAME_MAX_LENGTH).toBe(CATALOG_ITEM_LIMITS.nameMaxLength);
  });
});
