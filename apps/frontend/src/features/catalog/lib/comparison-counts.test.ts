import { describe, expect, it } from 'vitest';
import { countComparisonChanges } from './comparison-counts';

describe('countComparisonChanges (HU-082, T-082-32)', () => {
  it('counts changes without the unchanged items', () => {
    expect(
      countComparisonChanges([
        { change: 'ADDED' },
        { change: 'UNCHANGED' },
        { change: 'REMOVED' },
        { change: 'MODIFIED' },
        { change: 'UNCHANGED' },
      ]),
    ).toBe(3);

    expect(countComparisonChanges([{ change: 'UNCHANGED' }])).toBe(0);
    expect(countComparisonChanges([])).toBe(0);
  });
});
