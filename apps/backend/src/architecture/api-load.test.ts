import { describe, expect, it } from 'vitest';
// @ts-expect-error script sin archivo de declaraciones .d.ts
import * as apiLoad from '../../../../scripts/perf/api-load.mjs';

const { percentile, summarize, evaluate, parseArgs } = apiLoad;

describe('api-load script', () => {
  it('computes nearest-rank percentiles and handles empty input', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 100)).toBe(100);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 95)).toBeNull();
  });

  it('summarizes latencies and separates failures from rate limited requests', () => {
    const summary = summarize([
      { ms: 10, status: 200 },
      { ms: 20, status: 200 },
      { ms: 30, status: 500 },
      { ms: 40, status: 0 },
      { ms: 50, status: 429 },
    ]);
    expect(summary).toMatchObject({ count: 5, max: 50, failed: 2, rateLimited: 1 });
  });

  it('accepts a run within RNF-018 limits and rejects each kind of violation', () => {
    const good = { count: 10, p50: 5, p95: 499, p99: 600, max: 700, failed: 0, rateLimited: 0 };
    const goodWrites = { ...good, p95: 999 };
    expect(evaluate(good, goodWrites).ok).toBe(true);
    expect(evaluate(good, null).ok).toBe(true);

    expect(evaluate({ ...good, p95: 500 }, null).ok).toBe(false);
    expect(evaluate(good, { ...goodWrites, p95: 1000 }).ok).toBe(false);
    expect(evaluate({ ...good, failed: 1 }, null).ok).toBe(false);
    expect(evaluate({ ...good, rateLimited: 1 }, null).ok).toBe(false);
    expect(evaluate({ ...good, count: 0, p95: null }, null).ok).toBe(false);
  });

  it('parses options and rejects invalid values', () => {
    expect(parseArgs([])).toMatchObject({ users: 20, durationSeconds: 30, writes: false });
    expect(
      parseArgs(['--base-url', 'http://x:1/', '--users', '5', '--duration', '2', '--writes']),
    ).toMatchObject({ baseUrl: 'http://x:1', users: 5, durationSeconds: 2, writes: true });
    expect(() => parseArgs(['--users', '0'])).toThrow();
    expect(() => parseArgs(['--users'])).toThrow();
    expect(() => parseArgs(['--unknown'])).toThrow();
  });
});
