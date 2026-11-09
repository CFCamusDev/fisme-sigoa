import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const modulesDir = path.resolve(currentDir, '../..');

/**
 * Casos de uso públicos o de identidad propia que validan credenciales, tokens o la sesión
 * del propio actor sin exigir un código de permiso del catálogo (RS-002, D10).
 * También se excluye el módulo de referencia didáctico de arquitectura hexagonal.
 */
const PUBLIC_OR_SELF_IDENTITY_USE_CASES = new Set<string>([
  'auth/application/login.ts',
  'auth/application/refresh-session.ts',
  'auth/application/logout.ts',
  'auth/application/activate-account.ts',
  'auth/application/request-password-recovery.ts',
  'auth/application/reset-password.ts',
  'authorization/application/get-my-permissions.ts',
  'reference-module/application/create-reference-item.ts',
]);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export function analyzeUseCaseSource(
  relativePath: string,
  source: string,
): {
  readonly isUseCase: boolean;
  readonly isExempt: boolean;
  readonly hasAuthorizationCall: boolean;
} {
  const codeWithoutComments = stripComments(source);
  const definesUseCaseClass = /export\s+class\s+\w+UseCase\b/.test(codeWithoutComments);
  const definesExecuteMethod = /\bexecute\s*\(/.test(codeWithoutComments);
  const isUseCase = definesUseCaseClass && definesExecuteMethod;
  const isExempt = PUBLIC_OR_SELF_IDENTITY_USE_CASES.has(relativePath);
  const hasAuthorizationCall = /\.\s*(assertAllowed|assertAllowedOnResource)\s*\(/.test(
    codeWithoutComments,
  );

  return {
    isUseCase,
    isExempt,
    hasAuthorizationCall,
  };
}

function collectApplicationFiles(): Array<{
  readonly relativePath: string;
  readonly fullPath: string;
}> {
  const moduleEntries = readdirSync(modulesDir, { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  );
  const results: Array<{ readonly relativePath: string; readonly fullPath: string }> = [];

  for (const mod of moduleEntries) {
    const appDir = path.join(modulesDir, mod.name, 'application');
    let files: string[];
    try {
      files = readdirSync(appDir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (
        !file.endsWith('.ts') ||
        file.endsWith('.test.ts') ||
        file.endsWith('.spec.ts') ||
        file.endsWith('.types.ts') ||
        file === 'index.ts'
      ) {
        continue;
      }
      const relativePath = `${mod.name}/application/${file}`;
      results.push({
        relativePath,
        fullPath: path.join(appDir, file),
      });
    }
  }

  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

describe('Use Case Authorization Architecture Guard (RNF-009, RS-002, AGENTS §4.2)', () => {
  it('enforces that every non-exempt UseCase in modules/*/application calls assertAllowed or assertAllowedOnResource', () => {
    const files = collectApplicationFiles();
    const discoveredProtectedUseCases: string[] = [];
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file.fullPath, 'utf8');
      const analysis = analyzeUseCaseSource(file.relativePath, source);

      if (!analysis.isUseCase || analysis.isExempt) {
        continue;
      }

      discoveredProtectedUseCases.push(file.relativePath);
      if (!analysis.hasAuthorizationCall) {
        violations.push(file.relativePath);
      }
    }

    expect(discoveredProtectedUseCases.length).toBeGreaterThanOrEqual(14);
    expect(violations).toEqual([]);
  });

  it('detects a non-exempt UseCase that omits assertAllowed or only mentions it in comments', () => {
    const fakeSourceWithCommentOnly = `
      export class ViolatingUseCase {
        // await this.authorizer.assertAllowed({ actorId: '1', permission: 'rol.ver', scope: 'GLOBAL' });
        async execute(cmd: { actorId: string }) {
          return cmd.actorId;
        }
      }
    `;

    const analysis = analyzeUseCaseSource(
      'users/application/violating.ts',
      fakeSourceWithCommentOnly,
    );
    expect(analysis.isUseCase).toBe(true);
    expect(analysis.isExempt).toBe(false);
    expect(analysis.hasAuthorizationCall).toBe(false);
  });

  it('accepts a UseCase that invokes assertAllowedOnResource', () => {
    const validResourceUseCase = `
      export class GetCourseMeasurementUseCase {
        constructor(private readonly deps: { authorizer: { assertAllowedOnResource: (...args: unknown[]) => Promise<void> } }) {}
        async execute(cmd: { actorId: string; measurementId: string }) {
          await this.deps.authorizer.assertAllowedOnResource({
            actorId: cmd.actorId,
            permission: 'medicion.ver',
            resource: { type: 'CourseMeasurement', id: cmd.measurementId },
          });
        }
      }
    `;

    const analysis = analyzeUseCaseSource(
      'measurement/application/get-course-measurement.ts',
      validResourceUseCase,
    );
    expect(analysis.isUseCase).toBe(true);
    expect(analysis.isExempt).toBe(false);
    expect(analysis.hasAuthorizationCall).toBe(true);
  });
});
