import { describe, expect, it } from 'vitest';
import {
  buildGraph,
  toPosixPath,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/graph.mjs';
import {
  loadRules,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/rules.mjs';
import {
  collectChangedFiles,
  decideE2eScope,
  parseArgs,
  selectAffected,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/select.mjs';
import {
  findInsufficientSelection,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/audit.mjs';

function createVirtualHost(files: Record<string, string>) {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(files)) {
    normalized.set(toPosixPath(key), value);
  }
  return {
    fileExists(filePath: string) {
      return normalized.has(toPosixPath(filePath));
    },
    readFile(filePath: string) {
      return normalized.get(toPosixPath(filePath));
    },
  };
}

function buildSampleGraph() {
  const files = {
    'apps/backend/src/modules/users/application/create-user.ts':
      'export const createUser = () => true;',
    'apps/backend/src/modules/users/application/create-user.test.ts': `
      import { createUser } from './create-user';
      export const t = createUser;
    `,
    'apps/backend/src/modules/users/users.integration.test.ts': `
      import { app } from '../../app';
      export const t = app;
    `,
    'apps/backend/src/modules/roles/application/create-role.ts':
      'export const createRole = () => true;',
    'apps/backend/src/modules/roles/application/create-role.test.ts': `
      import { createRole } from './create-role';
      export const t = createRole;
    `,
    'apps/backend/src/modules/roles/roles.integration.test.ts': `
      import { app } from '../../app';
      export const t = app;
    `,
    'apps/backend/src/routes.ts': `
      import { createUser } from './modules/users/application/create-user';
      import { createRole } from './modules/roles/application/create-role';
      export const routes = [createUser, createRole];
    `,
    'apps/backend/src/app.ts': `
      import { routes } from './routes';
      export const app = { routes };
    `,
    'apps/backend/src/server.ts': `
      import { app } from './app';
      export const server = app;
    `,
    'apps/frontend/src/features/users/users-page.tsx': 'export const UsersPage = () => null;',
    'apps/frontend/src/features/users/users-page.test.tsx': `
      import { UsersPage } from './users-page';
      export const t = UsersPage;
    `,
    'packages/shared/src/index.ts': 'export const version = 1;',
    'packages/shared/src/index.test.ts': `
      import { version } from './index';
      export const t = version;
    `,
  };

  return buildGraph({
    root: '/repo',
    files: Object.keys(files),
    host: createVirtualHost(files),
  });
}

describe('affected selection engine (T-085-18, CA1, CA3, CA4, CA7)', () => {
  const rules = loadRules();

  it('selects the unit and integration tests that import an application file', () => {
    const graph = buildSampleGraph();
    const result = selectAffected({
      changedFiles: ['apps/backend/src/modules/users/application/create-user.ts'],
      graph,
      rules,
    });

    expect(result.mode).toBe('affected');
    expect(result.selection.backendUnit).toEqual([
      'apps/backend/src/modules/users/application/create-user.test.ts',
    ]);
    expect(result.selection.backendIntegration).toEqual([
      'apps/backend/src/modules/users/users.integration.test.ts',
    ]);
    expect(result.selection.frontend).toEqual([]);
  });

  it('always includes the changed test files', () => {
    const graph = buildSampleGraph();
    const result = selectAffected({
      changedFiles: ['apps/frontend/src/features/users/users-page.test.tsx'],
      graph,
      rules,
    });

    expect(result.mode).toBe('affected');
    expect(result.selection.frontend).toEqual([
      'apps/frontend/src/features/users/users-page.test.tsx',
    ]);
  });

  it('does not propagate through the composition roots', () => {
    const graph = buildSampleGraph();
    const result = selectAffected({
      changedFiles: ['apps/backend/src/modules/users/application/create-user.ts'],
      graph,
      rules,
    });

    expect(result.selection.backendUnit).not.toContain(
      'apps/backend/src/modules/roles/application/create-role.test.ts',
    );
    expect(result.selection.backendIntegration).not.toContain(
      'apps/backend/src/modules/roles/roles.integration.test.ts',
    );
  });

  it('selects the tests importing a changed composition root', () => {
    const graph = buildSampleGraph();
    const result = selectAffected({
      changedFiles: ['apps/backend/src/app.ts'],
      graph,
      rules,
    });

    expect(result.mode).toBe('affected');
    expect(result.selection.backendIntegration).toEqual([
      'apps/backend/src/modules/roles/roles.integration.test.ts',
      'apps/backend/src/modules/users/users.integration.test.ts',
    ]);
  });

  it('runs everything when the diff cannot be computed', () => {
    const graph = buildSampleGraph();
    const result = selectAffected({
      changedFiles: null,
      graph,
      rules,
    });

    expect(result.mode).toBe('all');
    expect(result.reason).toMatch(/diff/i);
    expect(result.totals.backendUnit.selected).toBe(result.totals.backendUnit.total);
    expect(result.totals.backendIntegration.selected).toBe(result.totals.backendIntegration.total);
    expect(result.selection.e2e.scope).toBe('full');
  });

  it('explains why each test was chosen', () => {
    const graph = buildSampleGraph();
    const result = selectAffected({
      changedFiles: ['apps/backend/src/modules/users/application/create-user.ts'],
      graph,
      rules,
    });

    const unitExplain = result.explain.find(
      (item: { target: string }) =>
        item.target === 'apps/backend/src/modules/users/application/create-user.test.ts',
    );
    expect(unitExplain).toBeDefined();
    expect(unitExplain?.reason).toContain('create-user.ts');
  });

  it('decides the e2e scope', () => {
    expect(decideE2eScope(['docs/historias.md', 'README.md'], rules).scope).toBe('none');
    expect(decideE2eScope(['scripts/ci/affected/select.mjs'], rules).scope).toBe('none');
    expect(decideE2eScope(['apps/frontend/src/features/users/users-page.tsx'], rules).scope).toBe(
      'full',
    );
    expect(decideE2eScope(['packages/shared/src/schemas/user.ts'], rules).scope).toBe('full');
    expect(decideE2eScope(['apps/backend/src/routes.ts'], rules).scope).toBe('full');
    expect(decideE2eScope(['apps/backend/prisma/schema.prisma'], rules).scope).toBe('full');
  });

  it('gives the same selection on repeated runs', () => {
    const graph = buildSampleGraph();
    const first = selectAffected({
      changedFiles: ['apps/backend/src/modules/users/application/create-user.ts'],
      graph,
      rules,
    });
    const second = selectAffected({
      changedFiles: ['apps/backend/src/modules/users/application/create-user.ts'],
      graph,
      rules,
    });

    expect(first).toEqual(second);
  });

  it('handles CLI edge cases and empty or accented paths', () => {
    expect(parseArgs([])).toEqual({ base: 'develop', explain: false, json: false });
    expect(parseArgs(['--base', 'origin/develop', '--explain', '--json'])).toEqual({
      base: 'origin/develop',
      explain: true,
      json: true,
    });
    expect(() => parseArgs(['--base'])).toThrow(/--base requiere/);
    expect(() => parseArgs(['--unknown'])).toThrow(/desconocido/);

    const graph = buildSampleGraph();
    const empty = selectAffected({ changedFiles: [], graph, rules });
    expect(empty.mode).toBe('affected');
    expect(empty.selection.e2e.scope).toBe('none');

    const withSpacesAndAccents = selectAffected({
      changedFiles: ['docs/carpeta con espacio/análisis.md'],
      graph,
      rules,
    });
    expect(withSpacesAndAccents.mode).toBe('affected');
    expect(withSpacesAndAccents.selection.backendUnit).toEqual([]);
  });

  it('reports tests that failed without being selected', () => {
    const selectionResult = {
      mode: 'affected',
      selection: {
        backendUnit: ['apps/backend/src/modules/users/application/create-user.test.ts'],
        backendIntegration: [],
        frontend: [],
        shared: [],
        e2e: { scope: 'none', reason: 'Sin cambios que afecten E2E' },
      },
    };

    expect(
      findInsufficientSelection({
        failedTests: [
          'apps/backend/src/modules/users/application/create-user.test.ts',
          'apps/backend/src/modules/roles/application/create-role.test.ts',
          'apps/frontend/e2e/users.spec.ts',
        ],
        selection: selectionResult,
      }),
    ).toEqual([
      'apps/backend/src/modules/roles/application/create-role.test.ts',
      'apps/frontend/e2e/users.spec.ts',
    ]);

    expect(
      findInsufficientSelection({
        failedTests: ['apps/backend/src/modules/roles/application/create-role.test.ts'],
        selection: { ...selectionResult, mode: 'all' },
      }),
    ).toEqual([]);
  });

  it('computes the diff against the merge base', () => {
    const calls: string[][] = [];
    const fakeExec = (_cmd: string, args: string[]) => {
      calls.push(args);
      if (args[0] === 'merge-base') return 'abc1234\n';
      if (args.includes('diff')) return 'apps/backend/src/a.ts\n';
      return 'apps/backend/src/untracked.ts\n';
    };

    const files = collectChangedFiles({
      base: 'develop',
      root: '/repo',
      mergeBase: true,
      exec: fakeExec,
    });

    expect(calls[0]).toEqual(['merge-base', 'develop', 'HEAD']);
    expect(calls[1]).toContain('abc1234');
    expect(files).toEqual(['apps/backend/src/a.ts', 'apps/backend/src/untracked.ts']);

    const failed = collectChangedFiles({
      base: 'missing-ref',
      root: '/repo',
      mergeBase: true,
      exec: () => {
        throw new Error('bad revision');
      },
    });
    expect(failed).toBeNull();
  });
});
