import { describe, expect, it } from 'vitest';
import {
  flakyTests,
  renderJobTimes,
  slowestTests,
  // @ts-expect-error script sin archivo de declaraciones .d.ts
} from '../../../../scripts/ci/ci-summary.mjs';
import baseline from '../../../../scripts/perf/baseline-2026-11-14.json' with { type: 'json' };

describe('ci-summary script (T-080-11)', () => {
  it('lists the ten slowest tests in order', () => {
    const vitestReport = {
      testResults: [
        {
          name: 'apps/backend/src/a.test.ts',
          assertionResults: Array.from({ length: 8 }, (_, idx) => ({
            fullName: `unit test ${idx + 1}`,
            duration: (idx + 1) * 100,
          })),
        },
      ],
    };
    const playwrightReport = {
      suites: [
        {
          title: 'e2e/sample.spec.ts',
          specs: Array.from({ length: 5 }, (_, idx) => ({
            title: `e2e test ${idx + 1}`,
            file: 'e2e/sample.spec.ts',
            tests: [{ results: [{ status: 'passed', duration: (idx + 1) * 1000 }] }],
          })),
        },
      ],
    };

    const top10 = slowestTests([vitestReport], [playwrightReport], 10);
    expect(top10).toHaveLength(10);
    expect(top10[0]).toMatchObject({ title: 'e2e test 5', durationMs: 5000 });
    expect(top10[9]).toMatchObject({ title: 'unit test 4', durationMs: 400 });
    for (let i = 1; i < top10.length; i += 1) {
      expect(top10[i - 1].durationMs).toBeGreaterThanOrEqual(top10[i].durationMs);
    }
  });

  it('lists tests that passed only after retrying', () => {
    const playwrightReport = {
      suites: [
        {
          title: 'e2e/flaky.spec.ts',
          specs: [
            {
              title: 'stable test',
              file: 'e2e/flaky.spec.ts',
              tests: [{ results: [{ status: 'passed', duration: 1200 }] }],
            },
            {
              title: 'flaky test',
              file: 'e2e/flaky.spec.ts',
              tests: [
                {
                  results: [
                    { status: 'failed', duration: 900 },
                    { status: 'passed', duration: 1500 },
                  ],
                },
              ],
            },
            {
              title: 'always failing test',
              file: 'e2e/flaky.spec.ts',
              tests: [
                {
                  results: [
                    { status: 'failed', duration: 900 },
                    { status: 'failed', duration: 900 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const flaky = flakyTests([playwrightReport]);
    expect(flaky).toEqual([
      {
        file: 'e2e/flaky.spec.ts',
        title: 'flaky test',
        attempts: 2,
        durationMs: 2400,
      },
    ]);
  });

  it('renders job times against the baseline', () => {
    const jobs = [
      {
        name: 'Calidad · Estáticas',
        started_at: '2026-11-14T10:00:00Z',
        completed_at: '2026-11-14T10:02:00Z', // 120 s -> 2 min
        conclusion: 'success',
      },
      {
        name: 'E2E · Shard 1/3',
        started_at: '2026-11-14T10:00:00Z',
        completed_at: '2026-11-14T10:03:00Z', // 180 s -> 3 min
        conclusion: 'success',
      },
    ];

    const markdown = renderJobTimes(jobs, baseline);
    expect(markdown).toContain('Calidad · Estáticas');
    expect(markdown).toContain('120.0 s');
    expect(markdown).toContain('E2E · Shard 1/3');
    expect(markdown).toContain('180.0 s');
    expect(markdown).toContain('21.3 min');
  });
});
