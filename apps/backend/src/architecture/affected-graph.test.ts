import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildGraph,
  toPosixPath,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/graph.mjs';

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

describe('affected graph builder (T-085-16)', () => {
  it('resolves static and dynamic imports', () => {
    const files = {
      'apps/backend/src/a.ts': `
        import { b } from './b';
        import type { CType } from './c';
        export async function loadD() {
          return import('./d');
        }
        const e = require('./e');
        export const out: CType = { ok: Boolean(b && e) };
      `,
      'apps/backend/src/b.ts': 'export const b = 1;',
      'apps/backend/src/c.ts': 'export type CType = { ok: boolean };',
      'apps/backend/src/d.ts': 'export const d = 2;',
      'apps/backend/src/e.ts': 'export const e = 3;',
    };

    const graph = buildGraph({
      root: '/repo',
      files: Object.keys(files),
      host: createVirtualHost(files),
    });

    expect(Array.from(graph.edges.get('apps/backend/src/a.ts') ?? []).sort()).toEqual([
      'apps/backend/src/b.ts',
      'apps/backend/src/c.ts',
      'apps/backend/src/d.ts',
      'apps/backend/src/e.ts',
    ]);
    expect(graph.reverse.get('apps/backend/src/d.ts')?.has('apps/backend/src/a.ts')).toBe(true);
  });

  it('follows export-from and export-star', () => {
    const files = {
      'packages/shared/src/index.ts': `
        export { foo } from './foo';
        export * from './bar';
      `,
      'packages/shared/src/foo.ts': 'export const foo = 1;',
      'packages/shared/src/bar.ts': 'export const bar = 2;',
    };

    const graph = buildGraph({
      root: '/repo',
      files: Object.keys(files),
      host: createVirtualHost(files),
    });

    expect(Array.from(graph.edges.get('packages/shared/src/index.ts') ?? []).sort()).toEqual([
      'packages/shared/src/bar.ts',
      'packages/shared/src/foo.ts',
    ]);
  });

  it('reads vi.mock literals', () => {
    const files = {
      'apps/backend/src/sample.test.ts': `
        import { vi, describe, it } from 'vitest';
        vi.mock('./dep-a');
        vi.doMock('./dep-b');
        async function helper() {
          await vi.importActual('./dep-c');
          await vi.importMock('./dep-d');
        }
        describe('x', () => { it('y', () => { void helper; }); });
      `,
      'apps/backend/src/dep-a.ts': 'export const a = 1;',
      'apps/backend/src/dep-b.ts': 'export const b = 2;',
      'apps/backend/src/dep-c.ts': 'export const c = 3;',
      'apps/backend/src/dep-d.ts': 'export const d = 4;',
    };

    const graph = buildGraph({
      root: '/repo',
      files: Object.keys(files),
      host: createVirtualHost(files),
    });

    expect(Array.from(graph.edges.get('apps/backend/src/sample.test.ts') ?? []).sort()).toEqual([
      'apps/backend/src/dep-a.ts',
      'apps/backend/src/dep-b.ts',
      'apps/backend/src/dep-c.ts',
      'apps/backend/src/dep-d.ts',
    ]);
  });

  it('resolves the frontend @ alias and .js extensions to ts files', () => {
    const files = {
      'apps/frontend/src/features/users/page.tsx': `
        import { formatDate } from '@/lib/date';
        import { sharedThing } from '@sigoa/shared';
        export const x = [formatDate, sharedThing];
      `,
      'apps/frontend/src/lib/date.ts': 'export const formatDate = () => "01/01/2026";',
      'apps/backend/src/modules/users/service.ts': `
        import { repo } from './repo.js';
        export const run = () => repo;
      `,
      'apps/backend/src/modules/users/repo.ts': 'export const repo = {};',
      'packages/shared/src/index.ts': 'export const sharedThing = true;',
    };

    const graph = buildGraph({
      root: '/repo',
      files: Object.keys(files),
      host: createVirtualHost(files),
    });

    expect(
      Array.from(graph.edges.get('apps/frontend/src/features/users/page.tsx') ?? []).sort(),
    ).toEqual(['apps/frontend/src/lib/date.ts', 'packages/shared/src/index.ts']);
    expect(Array.from(graph.edges.get('apps/backend/src/modules/users/service.ts') ?? [])).toEqual([
      'apps/backend/src/modules/users/repo.ts',
    ]);
  });

  it('ignores unresolvable specifiers without failing', () => {
    const files = {
      'apps/backend/src/broken.ts': `
        import { external } from 'some-npm-pkg';
        import { missing } from './does-not-exist';
        export const value = [external, missing];
      `,
    };

    const graph = buildGraph({
      root: '/repo',
      files: Object.keys(files),
      host: createVirtualHost(files),
    });

    expect(Array.from(graph.edges.get('apps/backend/src/broken.ts') ?? [])).toEqual([]);
    expect(graph.unresolved).toEqual([
      { file: 'apps/backend/src/broken.ts', specifier: './does-not-exist' },
    ]);
  });

  it('normalizes windows separators with path.win32', () => {
    const winRoot = path.win32.normalize('C:\\workspace\\demo-repo');
    const winFileA = path.win32.join(
      winRoot,
      'apps',
      'backend',
      'src',
      'carpeta con espacio',
      'área.ts',
    );
    const winFileB = path.win32.join(
      winRoot,
      'apps',
      'backend',
      'src',
      'carpeta con espacio',
      'base.ts',
    );

    const files = {
      'apps/backend/src/carpeta con espacio/área.ts': `import { base } from './base'; export const x = base;`,
      'apps/backend/src/carpeta con espacio/base.ts': 'export const base = 42;',
    };

    const graph = buildGraph({
      root: winRoot,
      files: [winFileA, winFileB],
      host: createVirtualHost(files),
    });

    expect(graph.nodes.has('apps/backend/src/carpeta con espacio/área.ts')).toBe(true);
    expect(graph.nodes.has('apps/backend/src/carpeta con espacio/base.ts')).toBe(true);
    expect(
      graph.edges
        .get('apps/backend/src/carpeta con espacio/área.ts')
        ?.has('apps/backend/src/carpeta con espacio/base.ts'),
    ).toBe(true);
  });
});
