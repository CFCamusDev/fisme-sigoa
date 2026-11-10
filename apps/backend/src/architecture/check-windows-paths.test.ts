import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error script sin archivo de declaraciones .d.ts
import * as checkWindowsPaths from '../../../../scripts/ci/check-windows-paths.mjs';

const { findWindowsPathViolations, scanRepositoryFiles, DEFAULT_EXCLUSIONS } = checkWindowsPaths;

describe('check-windows-paths (T-005-19, AGENTS §9, RNF-030)', () => {
  it('flags path.dirname on a file with a win32 branch and reports file and line', () => {
    const file = {
      path: 'scripts/sample.mjs',
      content: [
        "const isWin = process.platform === 'win32';",
        'if (isWin) {',
        "  const dir = path.dirname('C:\\\\foo\\\\bar');",
        '}',
      ].join('\n'),
    };

    const violations = findWindowsPathViolations([file], []);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      file: 'scripts/sample.mjs',
      line: 3,
      functionName: 'dirname',
      suggestion: 'path.win32.dirname',
    });
  });

  it('accepts path.win32.dirname', () => {
    const file = {
      path: 'scripts/sample.mjs',
      content: [
        "const isWin = process.platform === 'win32';",
        'if (isWin) {',
        "  const dir = path.win32.dirname('C:\\\\foo\\\\bar');",
        '}',
      ].join('\n'),
    };

    const violations = findWindowsPathViolations([file], []);
    expect(violations).toHaveLength(0);
  });

  it('flags named imports of dirname or join from node:path in a file with a Windows drive literal', () => {
    const file = {
      path: 'apps/backend/src/some.test.ts',
      content: [
        "import { dirname, join } from 'node:path';",
        "const p = 'C:\\\\Program Files\\\\App';",
      ].join('\n'),
    };

    const violations = findWindowsPathViolations([file], []);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]).toMatchObject({
      file: 'apps/backend/src/some.test.ts',
      line: 1,
    });
    expect(violations.some((v: { functionName: string }) => v.functionName === 'dirname')).toBe(
      true,
    );
  });

  it('ignores files without win32 or drive literals', () => {
    const file = {
      path: 'scripts/other.mjs',
      content: [
        "import path from 'node:path';",
        "const d = path.dirname('/home/user/app');",
        "const j = path.join('/var', 'log');",
      ].join('\n'),
    };

    const violations = findWindowsPathViolations([file], []);
    expect(violations).toHaveLength(0);
  });

  it('honours a justified exclusion and rejects an exclusion without reason', () => {
    const file = {
      path: 'scripts/special.mjs',
      content: [
        "const isWin = process.platform === 'win32';",
        "const d = path.dirname('C:\\\\test');",
      ].join('\n'),
    };

    // Con justificación válida se excluye
    const excludedViolations = findWindowsPathViolations(
      [file],
      [
        {
          file: 'scripts/special.mjs',
          reason: 'Usa path del host intencionalmente para pruebas locales.',
        },
      ],
    );
    expect(excludedViolations).toHaveLength(0);

    // Sin motivo o con motivo vacío debe rechazar la exclusión
    expect(() =>
      findWindowsPathViolations(
        [file],
        [{ file: 'scripts/special.mjs' } as unknown as { file: string; reason: string }],
      ),
    ).toThrow(/reason/i);

    expect(() =>
      findWindowsPathViolations([file], [{ file: 'scripts/special.mjs', reason: '   ' }]),
    ).toThrow(/reason/i);
  });

  it('scans the repository and finds no violations', () => {
    const repoRoot = path.resolve(__dirname, '../../../../');
    const files = scanRepositoryFiles(repoRoot);
    const violations = findWindowsPathViolations(files, DEFAULT_EXCLUSIONS);

    if (violations.length > 0) {
      const summary = violations
        .map(
          (v: { file: string; line: number; message: string }) =>
            `${v.file}:${v.line} - ${v.message}`,
        )
        .join('\n');
      expect.fail(`Se encontraron violaciones de rutas de Windows:\n${summary}`);
    }

    expect(violations).toEqual([]);
  }, 30_000);
});
