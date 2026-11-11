import { describe, expect, it } from 'vitest';
import { resolveE2EWorkers } from '../e2e/support/workers';

describe('resolveE2EWorkers (T-078-20, D10)', () => {
  it('defaults to 2 workers locally and 1 in the CI', () => {
    expect(resolveE2EWorkers({})).toBe(2);
    expect(resolveE2EWorkers({ CI: 'true' })).toBe(1);
  });

  it('uses E2E_WORKERS when it is a valid integer, also in the CI', () => {
    expect(resolveE2EWorkers({ E2E_WORKERS: '3' })).toBe(3);
    expect(resolveE2EWorkers({ E2E_WORKERS: '1' })).toBe(1);
    expect(resolveE2EWorkers({ E2E_WORKERS: '4', CI: 'true' })).toBe(4);
  });

  it('ignores an empty E2E_WORKERS', () => {
    expect(resolveE2EWorkers({ E2E_WORKERS: '  ' })).toBe(2);
  });

  it.each(['0', '-1', 'abc', '1.5', '33', '1e1'])('rejects E2E_WORKERS=%s', (value) => {
    expect(() => resolveE2EWorkers({ E2E_WORKERS: value })).toThrow(/E2E_WORKERS/);
  });
});
