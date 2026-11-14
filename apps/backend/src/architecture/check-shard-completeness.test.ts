import { describe, expect, it } from 'vitest';
import {
  checkShardCompleteness,
  extractPlaywrightTests,
  extractVitestTests,
  normalizeTestFilePath,
  // @ts-expect-error script sin archivo de declaraciones .d.ts
} from '../../../../scripts/ci/check-shard-completeness.mjs';

describe('check-shard-completeness script (T-080-07, T-080-08)', () => {
  const expectedPlaywright = {
    suites: [
      {
        title: 'e2e/login.spec.ts',
        specs: [
          {
            title: 'logs in successfully',
            file: 'e2e/login.spec.ts',
            tests: [{ projectName: 'chromium' }],
          },
          {
            title: 'shows validation error',
            file: 'e2e/login.spec.ts',
            tests: [{ projectName: 'chromium' }],
          },
        ],
      },
      {
        title: 'e2e/users.spec.ts',
        specs: [
          {
            title: 'lists users',
            file: 'e2e\\users.spec.ts', // separadores de Windows
            tests: [{ projectName: 'chromium' }],
          },
        ],
      },
    ],
  };

  it('passes when shards cover the full list exactly once', () => {
    const expected = extractPlaywrightTests(expectedPlaywright);
    const actual = extractPlaywrightTests({
      suites: [
        {
          title: 'e2e/login.spec.ts',
          specs: expectedPlaywright.suites[0].specs,
        },
        {
          title: 'e2e/users.spec.ts',
          specs: [
            {
              title: 'lists users',
              file: 'C:\\repo\\apps\\frontend\\e2e\\users.spec.ts',
              tests: [{ projectName: 'chromium' }],
            },
          ],
        },
      ],
    });

    expect(normalizeTestFilePath('C:\\repo\\apps\\frontend\\e2e\\users.spec.ts')).toBe(
      'e2e/users.spec.ts',
    );
    const result = checkShardCompleteness(expected, actual);
    expect(result).toEqual({
      ok: true,
      expectedCount: 3,
      actualCount: 3,
      repeated: [],
      omitted: [],
    });
  });

  it('fails when a test is repeated across shards', () => {
    const expected = extractPlaywrightTests(expectedPlaywright);
    const actual = [...expected, 'e2e/login.spec.ts :: logs in successfully'];

    const result = checkShardCompleteness(expected, actual);
    expect(result.ok).toBe(false);
    expect(result.repeated).toEqual(['e2e/login.spec.ts :: logs in successfully']);
    expect(result.omitted).toEqual([]);
  });

  it('fails when a test is omitted', () => {
    const expected = extractPlaywrightTests(expectedPlaywright);
    const actual = expected.slice(0, 2);

    const result = checkShardCompleteness(expected, actual);
    expect(result.ok).toBe(false);
    expect(result.omitted).toEqual(['e2e/users.spec.ts :: lists users']);
    expect(result.repeated).toEqual([]);
  });

  it('accepts the isolation list as an extra source', () => {
    const expected = extractVitestTests([
      { file: 'src/modules/users/user.test.ts', name: 'creates a user' },
      { file: 'src/architecture/worker-isolation.integration.test.ts', name: 'isolates workers' },
    ]);
    const shardsActual = extractVitestTests({
      testResults: [
        {
          name: '/home/runner/work/repo/apps/backend/src/modules/users/user.test.ts',
          assertionResults: [{ fullName: 'creates a user' }],
        },
      ],
    });
    const isolationExtra = extractVitestTests({
      testResults: [
        {
          name: 'C:\\PROYECTOS\\fisme-sigoa\\apps\\backend\\src\\architecture\\worker-isolation.integration.test.ts',
          assertionResults: [{ fullName: 'isolates workers' }],
        },
      ],
    });

    const result = checkShardCompleteness(expected, shardsActual, isolationExtra);
    expect(result).toEqual({
      ok: true,
      expectedCount: 2,
      actualCount: 2,
      repeated: [],
      omitted: [],
    });
  });
});
