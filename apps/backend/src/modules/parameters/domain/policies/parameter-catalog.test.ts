import { PARAMETER_DEFINITIONS, PARAMETER_KEYS as SHARED_KEYS } from '@sigoa/shared';
import { describe, expect, it } from 'vitest';
import { PARAMETER_CATALOG, PARAMETER_KEYS } from './parameter-catalog.js';

describe('parameter catalog parity with @sigoa/shared (T-011-08)', () => {
  it('has the same keys in the same order', () => {
    expect([...PARAMETER_KEYS]).toEqual([...SHARED_KEYS]);
  });

  it.each(SHARED_KEYS)('has the same unit, range and default for %s', (key) => {
    const shared = PARAMETER_DEFINITIONS[key];
    const domain = PARAMETER_CATALOG[key];
    expect({
      unit: domain.unit,
      min: domain.min,
      max: domain.max,
      defaultValue: domain.defaultValue,
    }).toEqual({
      unit: shared.unit,
      min: shared.min,
      max: shared.max,
      defaultValue: shared.defaultValue,
    });
  });
});
