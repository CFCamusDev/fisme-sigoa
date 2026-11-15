import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error script sin archivo de declaraciones .d.ts
import * as checkPerfBudgetModule from '../../../../scripts/ci/check-perf-budget.mjs';

const { checkPerfBudget, extractTestsFromReports, normalizeRepoRelativePath } =
  checkPerfBudgetModule;

const sampleBudget = {
  perTest: { unit: 2000, integration: 5000, e2e: 20000 },
  exceptions: [
    {
      file: 'apps/backend/src/test/db/worker-isolation.integration.test.ts',
      test: 'produces the same results with one and four workers',
      ms: 60000,
      reason: 'Ejecuta Vitest en paralelo con bases clonadas.',
    },
  ],
};

describe('check-perf-budget (HU-080, T-080-22)', () => {
  it('fails when a test exceeds its budget and is not listed', () => {
    const result = checkPerfBudget({
      tier: 'unit',
      tests: [
        {
          tool: 'vitest',
          file: 'apps/backend/src/modules/sample/slow.test.ts',
          title: 'takes too long',
          durationMs: 2500,
        },
      ],
      budget: { perTest: sampleBudget.perTest, exceptions: [] },
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      kind: 'budget-exceeded',
      file: 'apps/backend/src/modules/sample/slow.test.ts',
      test: 'takes too long',
    });
  });

  it('accepts a listed exception under its own limit', () => {
    const result = checkPerfBudget({
      tier: 'integration',
      tests: [
        {
          tool: 'vitest',
          file: 'apps/backend/src/test/db/worker-isolation.integration.test.ts',
          title: 'integration results > produces the same results with one and four workers',
          durationMs: 28000,
        },
      ],
      budget: sampleBudget,
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('fails when an exception limit is exceeded or the test no longer exists', () => {
    const exceeded = checkPerfBudget({
      tier: 'integration',
      tests: [
        {
          tool: 'vitest',
          file: 'apps/backend/src/test/db/worker-isolation.integration.test.ts',
          title: 'produces the same results with one and four workers',
          durationMs: 65000,
        },
      ],
      budget: sampleBudget,
    });
    expect(exceeded.ok).toBe(false);
    expect(exceeded.violations[0]?.kind).toBe('exception-exceeded');

    const stale = checkPerfBudget({
      tier: 'integration',
      tests: [
        {
          tool: 'vitest',
          file: 'apps/backend/src/modules/other/fast.integration.test.ts',
          title: 'runs fast',
          durationMs: 120,
        },
      ],
      budget: sampleBudget,
    });
    expect(stale.ok).toBe(false);
    expect(stale.violations[0]?.kind).toBe('stale-exception');
  });

  it('reads vitest and playwright reports', () => {
    const vitestReport = {
      testResults: [
        {
          name: path.win32.join(
            'C:',
            'PROYECTOS',
            'fisme-sigoa',
            'apps',
            'backend',
            'src',
            'sample.test.ts',
          ),
          assertionResults: [{ fullName: 'unit works', duration: 42 }],
        },
      ],
    };
    const playwrightReport = {
      suites: [
        {
          title: 'login.spec.ts',
          file: 'login.spec.ts',
          specs: [
            {
              title: 'logs in',
              file: 'login.spec.ts',
              tests: [{ results: [{ duration: 600 }, { duration: 400 }] }],
            },
          ],
        },
      ],
    };

    const extracted = extractTestsFromReports(
      [vitestReport],
      [playwrightReport],
      'C:/PROYECTOS/fisme-sigoa',
    );
    expect(extracted).toEqual([
      {
        tool: 'playwright',
        file: 'apps/frontend/e2e/login.spec.ts',
        title: 'logs in',
        durationMs: 1000,
      },
      {
        tool: 'vitest',
        file: 'apps/backend/src/sample.test.ts',
        title: 'unit works',
        durationMs: 42,
      },
    ]);
  });

  it('handles empty reports, null or negative durations and Windows backslashes', () => {
    const empty = extractTestsFromReports([{}], [{}], 'C:/repo');
    expect(empty).toEqual([]);

    const winNormalized = normalizeRepoRelativePath(
      path.win32.join('C:', 'work', 'repo', 'apps', 'frontend', 'src', 'a.test.ts'),
      path.win32.join('C:', 'work', 'repo'),
    );
    expect(winNormalized).toBe('apps/frontend/src/a.test.ts');

    const withNullDuration = extractTestsFromReports(
      [
        {
          testResults: [
            {
              name: 'apps/backend/src/null.test.ts',
              assertionResults: [{ fullName: 'null duration', duration: null }],
            },
          ],
        },
      ],
      [],
      '/repo',
    );
    expect(withNullDuration[0]?.durationMs).toBe(0);

    const negative = checkPerfBudget({
      tier: 'unit',
      tests: [
        { tool: 'vitest', file: 'apps/backend/src/neg.test.ts', title: 'neg', durationMs: -5 },
      ],
      budget: { perTest: sampleBudget.perTest, exceptions: [] },
    });
    expect(negative.ok).toBe(false);
    expect(negative.violations[0]?.kind).toBe('invalid-duration');
  });

  it('validates real perf-budget.json structure', () => {
    const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
    const budget = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'scripts', 'ci', 'perf-budget.json'), 'utf-8'),
    );
    expect(budget.perTest).toMatchObject({
      unit: expect.any(Number),
      integration: expect.any(Number),
      e2e: expect.any(Number),
    });
    expect(Array.isArray(budget.exceptions)).toBe(true);
    for (const exc of budget.exceptions) {
      expect(typeof exc.reason).toBe('string');
      expect(exc.reason.trim().length).toBeGreaterThan(0);
      expect(exc.ms).toBeGreaterThan(0);
    }
  });
});
