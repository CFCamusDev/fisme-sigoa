import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildGraph,
  discoverCodeFiles,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/graph.mjs';
import {
  loadRules,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/rules.mjs';
import {
  selectAffected,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/select.mjs';
import {
  refineSharedEdges,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/symbols.mjs';
import {
  buildScopedBackendCoverageCommand,
  getBackendCoverageTargets,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/verify-pr-local.mjs';
import {
  checkDiffInvariants,
  compareInjectFailureWithSelection,
  injectThrowIntoSource,
  restoreFileWithGit,
  runDiffsMode,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/perf/affected-harness.mjs';

const fixturesRoot = path.resolve(__dirname, '../../../../scripts/ci/affected/test-fixtures');

function buildFixtureGraph() {
  const files = discoverCodeFiles(fixturesRoot);
  const graph = buildGraph({ root: fixturesRoot, files });
  refineSharedEdges(graph);
  return graph;
}

describe('affected engine on fixture repository (T-085-20, CA5, CA9)', () => {
  const rules = loadRules();

  it('selects the module tests for an application change', () => {
    const graph = buildFixtureGraph();
    const result = selectAffected({
      changedFiles: ['apps/backend/src/modules/alpha/application/create-alpha.ts'],
      graph,
      rules,
    });

    expect(result.mode).toBe('affected');
    expect(result.selection.backendUnit).toEqual([
      'apps/backend/src/modules/alpha/application/create-alpha.test.ts',
    ]);
    expect(result.selection.backendIntegration).toEqual([
      'apps/backend/src/modules/alpha/alpha.integration.test.ts',
    ]);
    expect(result.selection.frontend).toEqual([]);
  });

  it('selects only the shared tests that use the symbol', () => {
    const graph = buildFixtureGraph();
    const result = selectAffected({
      changedFiles: ['packages/shared/src/alpha.ts'],
      graph,
      rules,
    });

    expect(result.mode).toBe('affected');
    expect(result.selection.shared).toEqual(['packages/shared/src/alpha.test.ts']);
    expect(result.selection.backendUnit).toEqual([
      'apps/backend/src/modules/alpha/application/create-alpha.test.ts',
    ]);
    expect(result.selection.frontend).toEqual([
      'apps/frontend/src/features/alpha/alpha-page.test.tsx',
    ]);
    expect(result.selection.backendUnit).not.toContain(
      'apps/backend/src/modules/beta/application/create-beta.test.ts',
    );
  });

  it('selects tests importing a composition root without crossing modules', () => {
    const graph = buildFixtureGraph();
    const result = selectAffected({
      changedFiles: ['apps/backend/src/app.ts'],
      graph,
      rules,
    });

    expect(result.mode).toBe('affected');
    expect(result.selection.backendIntegration).toEqual([
      'apps/backend/src/modules/alpha/alpha.integration.test.ts',
    ]);
  });

  it('runs everything for a global trigger and an unknown file', () => {
    const graph = buildFixtureGraph();

    const globalRes = selectAffected({
      changedFiles: ['pnpm-lock.yaml'],
      graph,
      rules,
    });
    expect(globalRes.mode).toBe('all');

    const unknownRes = selectAffected({
      changedFiles: ['untracked-root-file.txt'],
      graph,
      rules,
    });
    expect(unknownRes.mode).toBe('all');
  });

  it('decides the e2e scope on fixtures', () => {
    const graph = buildFixtureGraph();
    const docRes = selectAffected({
      changedFiles: ['docs/guide.md'],
      graph,
      rules,
    });
    expect(docRes.selection.e2e.scope).toBe('none');

    const uiRes = selectAffected({
      changedFiles: ['apps/frontend/src/features/alpha/alpha-page.tsx'],
      graph,
      rules,
    });
    expect(uiRes.selection.e2e.scope).toBe('full');
  });

  it('builds the coverage command for changed files', () => {
    const changed = ['apps/backend/src/modules/alpha/application/create-alpha.ts'];
    const targets = getBackendCoverageTargets(changed);
    expect(targets).toEqual(['src/modules/alpha/application/create-alpha.ts']);

    const cov = buildScopedBackendCoverageCommand(targets, [
      'src/modules/alpha/application/create-alpha.test.ts',
    ]);
    expect(cov?.command).toContain(
      '--coverage.include="src/modules/alpha/application/create-alpha.ts"',
    );
  });

  it('restores the injected file after the harness run', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigoa-harness-'));
    try {
      const targetFile = path.join(tmpDir, 'sample.ts');
      const original = "import { x } from './x';\nexport const run = () => x;\n";
      fs.writeFileSync(targetFile, original, 'utf8');

      const injected = injectThrowIntoSource(original);
      expect(injected).toContain("throw new Error('__SIGOA_HARNESS_INJECT__');");
      fs.writeFileSync(targetFile, injected, 'utf8');

      restoreFileWithGit('sample.ts', tmpDir, (_cmd: string, args: string[]) => {
        expect(args).toEqual(['checkout', '--', 'sample.ts']);
        fs.writeFileSync(targetFile, original, 'utf8');
        return '';
      });
      expect(fs.readFileSync(targetFile, 'utf8')).toBe(original);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('harness invariant: changed tests are always selected', () => {
    const graph = buildFixtureGraph();
    const changedFiles = ['apps/backend/src/modules/alpha/application/create-alpha.test.ts'];
    const selectionResult = selectAffected({ changedFiles, graph, rules });

    const inv = checkDiffInvariants({ changedFiles, selectionResult, rules });
    expect(inv.ok).toBe(true);
    expect(inv.missingChangedTests).toEqual([]);

    const comparisonOk = compareInjectFailureWithSelection({
      sampleFile: 'apps/backend/src/modules/alpha/application/create-alpha.ts',
      failedTests: ['apps/backend/src/modules/alpha/application/create-alpha.test.ts'],
      selectionResult,
    });
    expect(comparisonOk.ok).toBe(true);

    const comparisonMissing = compareInjectFailureWithSelection({
      sampleFile: 'apps/backend/src/modules/alpha/application/create-alpha.ts',
      failedTests: ['apps/backend/src/modules/beta/application/create-beta.test.ts'],
      selectionResult,
    });
    expect(comparisonMissing.ok).toBe(false);
    expect(comparisonMissing.missingTests).toEqual([
      'apps/backend/src/modules/beta/application/create-beta.test.ts',
    ]);
  });

  function initTempRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigoa-harness-git-'));
    const git = (args: string[]) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    git(['init', '-b', 'develop']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'user.name', 'Test User']);
    return { dir, git };
  }

  it('analyzes linear squash commits and fails when 0 commits match', () => {
    const { dir, git } = initTempRepo();
    try {
      const write = (rel: string, content: string) => {
        const abs = path.join(dir, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, 'utf8');
      };

      write('docs/init.md', '# Init\n');
      git(['add', 'docs/init.md']);
      git(['commit', '-m', 'docs: initial setup']);

      const emptyRes = runDiffsMode({ root: dir, baseRef: 'develop', count: 5 });
      expect(emptyRes.commitsAnalyzed).toBe(0);
      expect(emptyRes.ok).toBe(false);
      expect(emptyRes.error).toContain('0 casos analizados');

      write('apps/backend/src/modules/alpha/a.ts', 'export const a = 1;\n');
      write(
        'apps/backend/src/modules/alpha/a.test.ts',
        "import { a } from './a'; export const t = a;\n",
      );
      git([
        'add',
        'apps/backend/src/modules/alpha/a.ts',
        'apps/backend/src/modules/alpha/a.test.ts',
      ]);
      git(['commit', '-m', 'feat(alpha): add alpha module']);

      const res = runDiffsMode({ root: dir, baseRef: 'develop', count: 5 });
      expect(res.commitsAnalyzed).toBe(1);
      expect(res.ok).toBe(true);
      expect(res.items[0]?.selectedTotal).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('analyzes merge commits against their first parent', () => {
    const { dir, git } = initTempRepo();
    try {
      const write = (rel: string, content: string) => {
        const abs = path.join(dir, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, 'utf8');
      };

      write('docs/init.md', '# Init\n');
      git(['add', 'docs/init.md']);
      git(['commit', '-m', 'chore: init']);

      git(['switch', '-c', 'feature/alpha']);
      write('apps/backend/src/modules/alpha/a.ts', 'export const a = 1;\n');
      write(
        'apps/backend/src/modules/alpha/a.test.ts',
        "import { a } from './a'; export const t = a;\n",
      );
      git([
        'add',
        'apps/backend/src/modules/alpha/a.ts',
        'apps/backend/src/modules/alpha/a.test.ts',
      ]);
      git(['commit', '-m', 'feat(alpha): add a']);

      git(['switch', 'develop']);
      git(['merge', '--no-ff', 'feature/alpha', '-m', 'feat(alpha): merge feature alpha']);

      const res = runDiffsMode({ root: dir, baseRef: 'develop', count: 5 });
      expect(res.commitsAnalyzed).toBe(1);
      expect(res.ok).toBe(true);
      expect(res.items[0]?.changedCount).toBe(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
