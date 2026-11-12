import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PACKAGES,
  buildAffectedCommands,
  classifyChangedFiles,
  parseArgs,
  // @ts-expect-error script sin archivo de declaraciones .d.ts
} from '../../../../scripts/perf/test-affected.mjs';

describe('test-affected script (T-078-18)', () => {
  it('parses --base and --dry-run and rejects unknown arguments', () => {
    expect(parseArgs([])).toEqual({ base: 'develop', dryRun: false });
    expect(parseArgs(['--base', 'origin/develop', '--dry-run'])).toEqual({
      base: 'origin/develop',
      dryRun: true,
    });
    expect(() => parseArgs(['--base'])).toThrow(/--base requiere/);
    expect(() => parseArgs(['--base', '--dry-run'])).toThrow(/--base requiere/);
    expect(() => parseArgs(['--wat'])).toThrow(/desconocido/);
  });

  it('splits the changed files by package with paths relative to the package', () => {
    const groups = classifyChangedFiles([
      'apps/backend/src/modules/users/application/create-user.ts',
      'apps/frontend/src/features/users/users-page.tsx',
      'packages/shared/src/schemas/user.ts',
    ]);
    expect(groups).toEqual({
      backend: ['src/modules/users/application/create-user.ts'],
      frontend: ['src/features/users/users-page.tsx'],
      shared: ['src/schemas/user.ts'],
    });
  });

  it('ignores what is not code, e2e specs, generated output and other folders', () => {
    const groups = classifyChangedFiles([
      'README.md',
      'package.json',
      'pnpm-lock.yaml',
      'docs/historias.md',
      'apps/backend/prisma/schema.prisma',
      'apps/backend/dist/server.js',
      'apps/backend/coverage/lcov.info',
      'apps/frontend/e2e/users.spec.ts',
      'apps/frontend/test-results/a.js',
      'packages/shared/dist/index.js',
      'scripts/ci/verify-pr-local.mjs',
    ]);
    expect(groups).toEqual({ backend: [], frontend: [], shared: [] });
  });

  it('normalizes windows separators, deduplicates and keeps paths with spaces', () => {
    const groups = classifyChangedFiles([
      'apps\\backend\\src\\a b\\case.ts',
      'apps/backend/src/a b/case.ts',
      '  apps/frontend/src/x.tsx  ',
      '',
    ]);
    expect(groups.backend).toEqual(['src/a b/case.ts']);
    expect(groups.frontend).toEqual(['src/x.tsx']);
  });

  it('builds one vitest related command per package that has changes', () => {
    const commands = buildAffectedCommands(
      classifyChangedFiles([
        'apps/backend/src/a.ts',
        'apps/backend/src/b c.ts',
        'packages/shared/src/s.ts',
      ]),
    );

    expect(commands.map((command: { id: string }) => command.id)).toEqual(['backend', 'shared']);
    const backend = commands[0].command as string;
    expect(backend).toContain('pnpm --filter backend exec vitest related');
    expect(backend).toContain('"src/a.ts" "src/b c.ts"');
    expect(backend).toContain('--run --passWithNoTests --project unit');
    expect(commands[1].command).toContain(
      'pnpm --filter @sigoa/shared exec vitest related "src/s.ts"',
    );
    expect(commands[1].command).not.toContain('--project');
  });

  it('builds nothing when no package changed', () => {
    expect(buildAffectedCommands(classifyChangedFiles(['docs/x.md']))).toEqual([]);
  });

  it('covers the three packages that have unit tests', () => {
    expect(PACKAGES.map((pkg: { id: string }) => pkg.id)).toEqual([
      'backend',
      'frontend',
      'shared',
    ]);
  });
});

describe('test scripts in package.json (T-078-18, CA7)', () => {
  const repoRoot = path.resolve(__dirname, '../../../../');
  const scripts = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8')).scripts;

  it('keeps pnpm test with its current meaning', () => {
    expect(scripts['test']).toBe(
      'pnpm build:shared && pnpm db:generate && pnpm -r --if-present test',
    );
  });

  it('adds test:affected and test:fast without integration or e2e tests', () => {
    expect(scripts['test:affected']).toContain('scripts/perf/test-affected.mjs');
    expect(scripts['test:fast']).toContain('test:unit');
    expect(scripts['test:fast']).not.toMatch(/integration|e2e/);
  });
});
