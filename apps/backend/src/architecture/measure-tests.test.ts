import { describe, expect, it } from 'vitest';
import {
  GROUPS,
  buildReport,
  compareWithBaseline,
  parseArgs,
  parseTestCount,
  renderMarkdown,
  // @ts-expect-error script sin archivo de declaraciones .d.ts
} from '../../../../scripts/perf/measure-tests.mjs';

const baseline = {
  date: '2026-11-10',
  groups: { 'backend-integration': { seconds: 559.7, tests: 554 } },
};

describe('measure-tests script (T-078-01)', () => {
  it('parses the --only option into known group ids', () => {
    expect(parseArgs(['--only', 'shared,pdf']).only).toEqual(['shared', 'pdf']);
    expect(parseArgs([]).only).toBeNull();
  });

  it('rejects unknown groups, unknown flags and missing values', () => {
    expect(() => parseArgs(['--only', 'nope'])).toThrow(/Grupo desconocido/);
    expect(() => parseArgs(['--only'])).toThrow(/requiere/);
    expect(() => parseArgs(['--wat'])).toThrow(/desconocido/);
  });

  it('defines every group once', () => {
    const ids = GROUPS.map((group: { id: string }) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('backend-integration');
  });

  it('reads the number of passed tests from vitest and playwright output', () => {
    expect(parseTestCount(' Tests  554 passed (554)')).toBe(554);
    expect(parseTestCount('\u001b[2m      Tests \u001b[22m  \u001b[1m7 passed\u001b[22m')).toBe(7);
    expect(parseTestCount(' Tests  2 failed | 10 passed (12)')).toBe(10);
    expect(parseTestCount('  71 passed (3.9m)')).toBe(71);
    expect(parseTestCount('nothing here')).toBeNull();
  });

  it('compares a measurement with the baseline', () => {
    const result = compareWithBaseline(
      { id: 'backend-integration', seconds: 100, tests: 554, ok: true },
      baseline.groups['backend-integration'],
    );
    expect(result).toEqual({
      baselineSeconds: 559.7,
      deltaSeconds: -459.7,
      speedup: 5.6,
      testsDelta: 0,
    });
  });

  it('leaves comparison empty when the group has no baseline', () => {
    expect(compareWithBaseline({ id: 'x', seconds: 1, tests: 1, ok: true }, undefined)).toEqual({
      baselineSeconds: null,
      deltaSeconds: null,
      speedup: null,
      testsDelta: null,
    });
  });

  it('renders a markdown table with one row per group', () => {
    const report = buildReport(
      [
        {
          id: 'backend-integration',
          name: 'Integración backend',
          seconds: 120,
          tests: 554,
          ok: true,
        },
      ],
      baseline,
      '2026-11-11T00:00:00.000Z',
    );
    const markdown = renderMarkdown(report);
    expect(markdown).toContain(
      '| Integración backend | OK | 120 | 559.7 | -439.7 | 4.7 | 554 | 0 |',
    );
    expect(markdown).toContain('Línea base: 2026-11-10');
  });
});
