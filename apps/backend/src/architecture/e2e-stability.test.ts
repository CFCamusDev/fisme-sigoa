import { describe, expect, it } from 'vitest';
import {
  evaluateRun,
  parseArgs,
  // @ts-expect-error script sin archivo de declaraciones .d.ts
} from '../../../../scripts/perf/e2e-stability.mjs';

describe('e2e-stability script (T-078-21)', () => {
  it('defaults to 3 runs with 3 workers and reads --runs and --workers', () => {
    expect(parseArgs([])).toEqual({ runs: 3, workers: 3 });
    expect(parseArgs(['--runs', '5', '--workers', '2'])).toEqual({ runs: 5, workers: 2 });
  });

  it.each([['0'], ['-1'], ['abc'], ['33'], ['1.5'], ['']])('rejects --runs %j', (value) => {
    expect(() => parseArgs(['--runs', value])).toThrow(/--runs debe ser un entero/);
  });

  it('rejects unknown arguments and missing values', () => {
    expect(() => parseArgs(['--wat'])).toThrow(/desconocido/);
    expect(() => parseArgs(['--workers'])).toThrow(/--workers debe ser un entero/);
  });

  it('accepts a run where everything passed', () => {
    expect(evaluateRun({ expected: 55, unexpected: 0, flaky: 0, skipped: 0 })).toEqual({
      ok: true,
      reasons: [],
      passed: 55,
    });
  });

  it('counts a flaky test (passed only on retry) as a failure', () => {
    const result = evaluateRun({ expected: 54, unexpected: 0, flaky: 1, skipped: 0 });
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toMatch(/inestables/);
  });

  it('fails on unexpected failures and on skipped tests', () => {
    expect(evaluateRun({ expected: 50, unexpected: 2, flaky: 0, skipped: 0 }).reasons[0]).toMatch(
      /2 prueba\(s\) fallaron/,
    );
    expect(evaluateRun({ expected: 50, unexpected: 0, flaky: 0, skipped: 1 }).ok).toBe(false);
  });

  it('fails when no test ran or the stats are missing', () => {
    expect(evaluateRun({ expected: 0, unexpected: 0, flaky: 0, skipped: 0 }).ok).toBe(false);
    expect(evaluateRun(undefined).ok).toBe(false);
  });
});
