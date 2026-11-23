import { describe, expect, it } from 'vitest';
import { getImportStep } from './import-steps';

describe('getImportStep (HU-082, T-082-38)', () => {
  it('derives the current step', () => {
    expect(getImportStep(false, false)).toBe(1);
    expect(getImportStep(false, true)).toBe(1);
    expect(getImportStep(true, false)).toBe(2);
    expect(getImportStep(true, true)).toBe(3);
  });
});
