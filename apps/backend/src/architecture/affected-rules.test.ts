import { describe, expect, it } from 'vitest';
import {
  buildGraph,
  toPosixPath,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/graph.mjs';
import {
  refineSharedEdges,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/symbols.mjs';
import {
  classifyTestFile,
  getModuleAffinityMatches,
  isCompositionRoot,
  isGlobalTrigger,
  isInertFile,
  isKnownCodeFile,
  loadRules,
  matchesE2eFullTrigger,
  // @ts-expect-error script ESM sin declaraciones .d.ts
} from '../../../../scripts/ci/affected/rules.mjs';

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

describe('shared symbol resolution (T-085-17, CA2)', () => {
  it('links each shared import to the file that defines the symbol', () => {
    const files = {
      'packages/shared/src/index.ts': `
        export { UserSchema } from './schemas/user';
        export * from './schemas/role';
      `,
      'packages/shared/src/schemas/user.ts': 'export const UserSchema = { kind: "user" };',
      'packages/shared/src/schemas/role.ts': 'export const RoleSchema = { kind: "role" };',
      'apps/backend/src/modules/users/user.test.ts': `
        import { UserSchema } from '@sigoa/shared';
        export const u = UserSchema;
      `,
      'apps/frontend/src/features/roles/role.test.tsx': `
        import { RoleSchema } from '@sigoa/shared';
        export const r = RoleSchema;
      `,
    };

    const graph = buildGraph({
      root: '/repo',
      files: Object.keys(files),
      host: createVirtualHost(files),
    });
    refineSharedEdges(graph);

    expect(
      Array.from(graph.edges.get('apps/backend/src/modules/users/user.test.ts') ?? []),
    ).toEqual(['packages/shared/src/schemas/user.ts']);
    expect(
      Array.from(graph.edges.get('apps/frontend/src/features/roles/role.test.tsx') ?? []),
    ).toEqual(['packages/shared/src/schemas/role.ts']);
    expect(
      graph.reverse
        .get('packages/shared/src/schemas/user.ts')
        ?.has('apps/frontend/src/features/roles/role.test.tsx'),
    ).toBe(false);
  });

  it('falls back to the whole barrel for namespace imports', () => {
    const files = {
      'packages/shared/src/index.ts': `
        export { UserSchema } from './schemas/user';
        export { RoleSchema } from './schemas/role';
      `,
      'packages/shared/src/schemas/user.ts': 'export const UserSchema = 1;',
      'packages/shared/src/schemas/role.ts': 'export const RoleSchema = 2;',
      'apps/backend/src/ns.test.ts': `
        import * as shared from '@sigoa/shared';
        export const all = shared;
      `,
      'apps/backend/src/unknown-symbol.test.ts': `
        import { NonExistent } from '@sigoa/shared';
        export const u = NonExistent;
      `,
    };

    const graph = buildGraph({
      root: '/repo',
      files: Object.keys(files),
      host: createVirtualHost(files),
    });
    refineSharedEdges(graph);

    const expectedAll = [
      'packages/shared/src/index.ts',
      'packages/shared/src/schemas/role.ts',
      'packages/shared/src/schemas/user.ts',
    ];
    expect(Array.from(graph.edges.get('apps/backend/src/ns.test.ts') ?? []).sort()).toEqual(
      expectedAll,
    );
    expect(
      Array.from(graph.edges.get('apps/backend/src/unknown-symbol.test.ts') ?? []).sort(),
    ).toEqual(expectedAll);
  });
});

describe('selection rules (T-085-17, CA3, CA4, CA7)', () => {
  const rules = loadRules();

  it('treats every global trigger as run-everything', () => {
    const triggers = [
      'pnpm-lock.yaml',
      'package.json',
      'apps/backend/package.json',
      'tsconfig.base.json',
      'apps/frontend/vitest.config.ts',
      'apps/frontend/vitest-projects.json',
      'apps/backend/prisma/schema.prisma',
      'apps/backend/src/test/factories.ts',
      'apps/frontend/src/test/setup.ts',
      '.github/workflows/pr-checks.yml',
      'apps/frontend/playwright.config.ts',
    ];

    for (const file of triggers) {
      expect(isGlobalTrigger(file, rules), `Expected global trigger: ${file}`).toBe(true);
    }
  });

  it('treats an unknown file as non-inert and outside known code', () => {
    const unknownFile = 'custom-root-script.sh';
    expect(isGlobalTrigger(unknownFile, rules)).toBe(false);
    expect(isInertFile(unknownFile, rules)).toBe(false);
    expect(isKnownCodeFile(unknownFile, rules)).toBe(false);
    expect(classifyTestFile(unknownFile, rules)).toBeNull();
  });

  it('treats documentation as inert', () => {
    expect(isInertFile('docs/historias.md', rules)).toBe(true);
    expect(isInertFile('README.md', rules)).toBe(true);
    expect(isInertFile('docs/backlog.csv', rules)).toBe(true);
    expect(isInertFile('docs/diseno/logo.png', rules)).toBe(true);
    expect(isInertFile('apps/backend/src/app.ts', rules)).toBe(false);
  });

  it('identifies composition roots and e2e triggers', () => {
    expect(isCompositionRoot('apps/backend/src/routes.ts', rules)).toBe(true);
    expect(isCompositionRoot('apps/backend/src/app.ts', rules)).toBe(true);
    expect(isCompositionRoot('apps/backend/src/server.ts', rules)).toBe(true);
    expect(isCompositionRoot('apps/backend/src/modules/users/service.ts', rules)).toBe(false);

    expect(matchesE2eFullTrigger('apps/frontend/src/features/users/page.tsx', rules)).toBe(true);
    expect(matchesE2eFullTrigger('packages/shared/src/schemas/user.ts', rules)).toBe(true);
    expect(matchesE2eFullTrigger('apps/backend/src/routes.ts', rules)).toBe(true);
    expect(matchesE2eFullTrigger('apps/frontend/src/features/users/page.test.tsx', rules)).toBe(
      false,
    );
    expect(matchesE2eFullTrigger('scripts/ci/affected/select.mjs', rules)).toBe(false);
  });

  it('maps module affinity', () => {
    const nodes = [
      'apps/backend/src/modules/users/application/create-user.test.ts',
      'apps/backend/src/modules/users/users.integration.test.ts',
      'apps/backend/src/users-api.integration.test.ts',
      'apps/backend/src/modules/roles/application/create-role.test.ts',
    ];

    expect(
      getModuleAffinityMatches(
        'apps/backend/src/modules/users/application/create-user.ts',
        nodes,
        rules,
      ),
    ).toEqual([
      'apps/backend/src/modules/users/application/create-user.test.ts',
      'apps/backend/src/modules/users/users.integration.test.ts',
      'apps/backend/src/users-api.integration.test.ts',
    ]);
  });
});
