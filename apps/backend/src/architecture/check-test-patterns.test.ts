import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error script sin archivo de declaraciones .d.ts
import * as checkTestPatterns from '../../../../scripts/ci/check-test-patterns.mjs';

const { findSlowSeedViolations, scanIntegrationTests, stripComments, DEFAULT_EXCLUSIONS } =
  checkTestPatterns;

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
