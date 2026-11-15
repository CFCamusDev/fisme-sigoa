import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error script sin archivo de declaraciones .d.ts
import * as checkTestPatterns from '../../../../scripts/ci/check-test-patterns.mjs';

const {
  findSlowSeedViolations,
  findE2ESubprocessViolations,
  findFixedPauseViolations,
  findUiLoginViolations,
  findDomInNodeViolations,
  resolveFrontendNodeFiles,
  scanIntegrationTests,
  scanAllTests,
  stripComments,
  DEFAULT_EXCLUSIONS,
  RULE_EXCLUSIONS,
} = checkTestPatterns;

const integrationPath = 'apps/backend/src/modules/sample/sample.integration.test.ts';

describe('check-test-patterns (HU-012, AGENTS §9, RNF-030)', () => {
  it('flags an import of seedAuthorization with file and line', () => {
    const file = {
      path: integrationPath,
      content: [
        "import { describe } from 'vitest';",
        "import { seedAuthorization } from '../seed';",
      ].join('\n'),
    };

    const violations = findSlowSeedViolations([file], []);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: integrationPath, line: 2 });
  });

  it('flags a call to seedAuthorization', () => {
    const file = {
      path: integrationPath,
      content: ['beforeEach(async () => {', '  await seedAuthorization(prisma);', '});'].join('\n'),
    };

    const violations = findSlowSeedViolations([file], []);
    expect(violations.map((v: { line: number }) => v.line)).toEqual([2]);
  });

  it('ignores seedAuthorizationFast', () => {
    const file = {
      path: integrationPath,
      content: [
        "import { seedAuthorizationFast } from '../seed';",
        'await seedAuthorizationFast(prisma);',
      ].join('\n'),
    };

    expect(findSlowSeedViolations([file], [])).toEqual([]);
  });

  it('ignores mentions inside line and block comments', () => {
    const file = {
      path: integrationPath,
      content: [
        '// no uses seedAuthorization aquí',
        '/* seedAuthorization',
        '   sigue en el comentario */',
        'const ok = true; // seedAuthorization',
      ].join('\n'),
    };

    expect(findSlowSeedViolations([file], [])).toEqual([]);
  });

  it('keeps line numbers after stripping comments', () => {
    const stripped = stripComments(['/* a', 'b */', 'seedAuthorization();'].join('\n'));
    expect(stripped.split('\n')[2]).toBe('seedAuthorization();');
  });

  it('only inspects integration test files', () => {
    const file = {
      path: 'apps/backend/src/modules/sample/sample.test.ts',
      content: 'seedAuthorization();',
    };

    expect(findSlowSeedViolations([file], [])).toEqual([]);
  });

  it('respects an exclusion that has a reason', () => {
    const file = { path: integrationPath, content: 'seedAuthorization();' };

    const violations = findSlowSeedViolations(
      [file],
      [{ file: integrationPath, reason: 'Prueba la siembra misma.' }],
    );
    expect(violations).toEqual([]);
  });

  it('rejects an exclusion without a reason', () => {
    const file = { path: integrationPath, content: 'seedAuthorization();' };

    expect(() => findSlowSeedViolations([file], [{ file: integrationPath, reason: '  ' }])).toThrow(
      /non-empty reason/,
    );
  });

  it('normalizes Windows separators before comparing paths', () => {
    const windowsPath = path.win32.join(
      'apps',
      'backend',
      'src',
      'modules',
      'sample',
      'sample.integration.test.ts',
    );
    const file = { path: windowsPath, content: 'seedAuthorization();' };

    expect(findSlowSeedViolations([file], [])).toHaveLength(1);
    expect(findSlowSeedViolations([file], [{ file: integrationPath, reason: 'Motivo.' }])).toEqual(
      [],
    );
  });

  it('has a reason for every default exclusion', () => {
    expect(DEFAULT_EXCLUSIONS.length).toBeGreaterThan(0);
    for (const exclusion of DEFAULT_EXCLUSIONS) {
      expect(exclusion.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('passes on the real repository', () => {
    const files = scanIntegrationTests(fileURLToPath(new URL('../../../../', import.meta.url)));

    expect(files.length).toBeGreaterThan(0);
    expect(findSlowSeedViolations(files, DEFAULT_EXCLUSIONS)).toEqual([]);
  }, 15_000);
});

describe('check-test-patterns fast rules (HU-080, T-080-20, T-080-21)', () => {
  const specPath = 'apps/frontend/e2e/sample.spec.ts';

  it('flags execSync and spawnSync in e2e specs', () => {
    const file = {
      path: specPath,
      content: [
        "import { execSync } from 'node:child_process';",
        "execSync('echo hi');",
        "spawnSync('node', ['-v']);",
      ].join('\n'),
    };

    const violations = findE2ESubprocessViolations([file], []);
    expect(violations.map((v: { line: number }) => v.line)).toEqual([1, 2, 3]);
    expect(violations[0]).toMatchObject({ rule: 'e2e-subprocess', file: specPath });
  });

  it('allows child processes in e2e support files', () => {
    const supportFile = {
      path: 'apps/frontend/e2e/support/helper.ts',
      content: "import { execSync } from 'node:child_process';\nexecSync('echo ok');",
    };
    const globalSetupFile = {
      path: 'apps/frontend/e2e/global-setup.ts',
      content: "import { spawnSync } from 'node:child_process';\nspawnSync('node', ['-v']);",
    };

    expect(findE2ESubprocessViolations([supportFile, globalSetupFile], [])).toEqual([]);
  });

  it('flags waitForTimeout and fixed sleeps', () => {
    const e2eFile = {
      path: specPath,
      content: [
        '// page.waitForTimeout(100) en comentario se ignora',
        'await page.waitForTimeout(250);',
        'await new Promise((resolve) => setTimeout(resolve, 20));',
      ].join('\n'),
    };
    const unitFile = {
      path: 'apps/frontend/src/sample.test.ts',
      content: [
        'await sleep(50);',
        'await new Promise((resolve) => setTimeout(resolve, 200));',
      ].join('\n'),
    };
    const shortMockUnitFile = {
      path: 'apps/frontend/src/short-mock.test.ts',
      content: 'await new Promise((resolve) => setTimeout(resolve, 30));',
    };

    const violations = findFixedPauseViolations([e2eFile, unitFile, shortMockUnitFile], []);
    expect(violations).toHaveLength(4);
    expect(violations.map((v: { file: string; line: number }) => [v.file, v.line])).toEqual([
      [specPath, 2],
      [specPath, 3],
      ['apps/frontend/src/sample.test.ts', 1],
      ['apps/frontend/src/sample.test.ts', 2],
    ]);
  });

  it('allows fake timers', () => {
    const file = {
      path: 'apps/frontend/src/timer.test.ts',
      content: [
        'vi.useFakeTimers();',
        'await sleep(100);',
        'await new Promise((resolve) => setTimeout(resolve, 500));',
      ].join('\n'),
    };

    expect(findFixedPauseViolations([file], [])).toEqual([]);
  });

  it('flags ui sign in outside authentication specs', () => {
    const nonAuthSpec = {
      path: 'apps/frontend/e2e/catalog-editor.spec.ts',
      content: "await page.getByRole('button', { name: /acceder al sistema/i }).click();",
    };
    const authSpec = {
      path: 'apps/frontend/e2e/login.spec.ts',
      content: "await page.getByRole('button', { name: /acceder al sistema/i }).click();",
    };
    const gotoOnlySpec = {
      path: 'apps/frontend/e2e/navigation.spec.ts',
      content: "await page.goto('/login');",
    };

    const violations = findUiLoginViolations([nonAuthSpec, authSpec, gotoOnlySpec], []);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      rule: 'ui-login',
      file: 'apps/frontend/e2e/catalog-editor.spec.ts',
      line: 1,
    });
  });

  it('flags dom imports in node project files', () => {
    const nodeFiles = new Set(['apps/frontend/src/lib/sample.test.ts']);
    const nodeFile = {
      path: 'apps/frontend/src/lib/sample.test.ts',
      content: [
        "import { render } from '@testing-library/react';",
        'expect(window.location.href).toBe("/");',
      ].join('\n'),
    };
    const domFile = {
      path: 'apps/frontend/src/components/button.test.tsx',
      content: "import { render } from '@testing-library/react';",
    };

    const violations = findDomInNodeViolations([nodeFile, domFile], [], nodeFiles);
    expect(violations).toHaveLength(2);
    expect(violations.map((v: { line: number }) => v.line)).toEqual([1, 2]);
  });

  it('rejects a rule exclusion without a reason', () => {
    const file = { path: specPath, content: "execSync('echo hi');" };
    expect(() =>
      findE2ESubprocessViolations([file], [{ file: specPath, rule: 'e2e-subprocess', reason: '' }]),
    ).toThrow(/non-empty reason/);

    for (const exc of RULE_EXCLUSIONS) {
      expect(exc.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('passes all fast-test rules on the real repository', () => {
    const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
    const files = scanAllTests(repoRoot);
    const nodeFiles = resolveFrontendNodeFiles(repoRoot);

    expect(files.length).toBeGreaterThan(0);
    expect(nodeFiles.size).toBeGreaterThan(0);
    expect(findE2ESubprocessViolations(files, RULE_EXCLUSIONS)).toEqual([]);
    expect(findFixedPauseViolations(files, RULE_EXCLUSIONS)).toEqual([]);
    expect(findUiLoginViolations(files, RULE_EXCLUSIONS)).toEqual([]);
    expect(findDomInNodeViolations(files, RULE_EXCLUSIONS, nodeFiles)).toEqual([]);
  }, 15_000);
});
