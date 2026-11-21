#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guardia de patrones de pruebas (HU-012, HU-078, HU-080):
 * - slow-seed: prohíbe seedAuthorization en pruebas de integración (usar seedAuthorizationFast).
 * - e2e-subprocess: prohíbe execSync/execFileSync/spawnSync/child_process en *.spec.ts de E2E.
 * - fixed-pause: prohíbe waitForTimeout, sleep() y pausas fijas con setTimeout sin fake timers.
 * - ui-login: prohíbe iniciar sesión por interfaz en specs E2E fuera de autenticación.
 * - dom-in-node: prohíbe importaciones o globales de DOM en archivos asignados al proyecto node.
 */
export const SLOW_SEED_NAME = 'seedAuthorization';

export const DEFAULT_EXCLUSIONS = [
  {
    file: 'apps/backend/src/modules/authorization/infrastructure/prisma/seed/authorization-seed.integration.test.ts',
    reason: 'Prueba la siembra de producción misma, que es la siembra lenta.',
  },
  {
    file: 'apps/backend/src/test/factories/authorization-fast.integration.test.ts',
    reason: 'Compara la siembra rápida contra la lenta para garantizar que producen lo mismo.',
  },
];

export const AUTH_E2E_SPECS = new Set([
  'login.spec.ts',
  'session.spec.ts',
  'activation.spec.ts',
  'recovery.spec.ts',
]);

export const RULE_EXCLUSIONS = [
  {
    file: 'apps/frontend/e2e/authorization.spec.ts',
    rule: 'e2e-subprocess',
    reason: 'Consulta el hash del token de activación en BD durante la prueba de autorización E2E.',
  },
  {
    file: 'apps/backend/src/architecture/test-hygiene.test.ts',
    rule: 'fixed-pause',
    reason: "Contiene el literal 'sleep()' como nombre de regla para auditar pruebas de integración.",
  },
  {
    file: 'apps/backend/src/architecture/check-test-patterns.test.ts',
    rule: 'fixed-pause',
    reason: 'Contiene literales de prueba con waitForTimeout y sleep para verificar las reglas de check-test-patterns.',
  },
  {
    file: 'apps/backend/src/shared/pdf/puppeteer-pdf-generator.test.ts',
    rule: 'fixed-pause',
    reason: 'Simula latencia de renderizado en un mock de concurrencia de generación PDF.',
  },
  {
    file: 'apps/frontend/src/features/parameters/components/parameters-form.test.tsx',
    rule: 'fixed-pause',
    reason: 'Handler MSW parametrizado (postDelayMs) para simular petición en vuelo al probar doble envío.',
  },
  {
    file: 'apps/frontend/src/features/users/components/user-form.test.tsx',
    rule: 'fixed-pause',
    reason: 'Handler MSW con retardo corto (100 ms) para simular petición en vuelo al probar doble clic.',
  },
  {
    file: 'apps/frontend/e2e/authorization.spec.ts',
    rule: 'ui-login',
    reason: 'Verifica el inicio de sesión por interfaz de un usuario recién activado o con roles editados.',
  },
  {
    file: 'apps/frontend/e2e/contrast.spec.ts',
    rule: 'ui-login',
    reason: 'Recorre la pantalla de inicio de sesión y valida su contraste WCAG.',
  },
  {
    file: 'apps/frontend/e2e/users.spec.ts',
    rule: 'ui-login',
    reason: 'Prueba el inicio de sesión por interfaz tras crear o desactivar usuarios.',
  },
  {
    file: 'apps/frontend/e2e/worker-isolation.spec.ts',
    rule: 'ui-login',
    reason: 'Comprueba que el formulario de login envía POST /auth/login hacia la API del worker.',
  },
  {
    file: 'apps/frontend/src/e2e-web-copy.test.ts',
    rule: 'dom-in-node',
    reason: 'Incluye "<script>window.__API__=..." como cadena HTML de prueba sin usar el DOM real.',
  },
  {
    file: 'apps/frontend/src/vitest-projects.test.ts',
    rule: 'dom-in-node',
    reason: 'Comprueba mediante expresión regular que setup-node.ts no referencia window ni document.',
  },
];

// \b no cruza hacia "Fast": seedAuthorizationFast no coincide.
const SLOW_SEED_REGEX = new RegExp(`\\b${SLOW_SEED_NAME}\\b`);
const E2E_SUBPROCESS_REGEX = /\b(execSync|execFileSync|spawnSync|child_process)\b/;
const WAIT_FOR_TIMEOUT_REGEX = /\bwaitForTimeout\s*\(/;
const SLEEP_CALL_REGEX = /\bsleep\s*\(/;
const FAKE_TIMERS_REGEX = /\bvi\.useFakeTimers\s*\(/;
const PROMISE_SETTIMEOUT_REGEX = /new\s+Promise[\s\S]{0,160}?\bsetTimeout\s*\(([^)]+)\)/g;
const UI_LOGIN_REGEX =
  /getByRole\(\s*['"]button['"]\s*,\s*\{\s*name\s*:\s*\/acceder al sistema\/i/;
const DOM_IMPORT_REGEX =
  /(?:from\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])(?:@testing-library\/|jsdom\b|happy-dom\b|react-dom\b|@\/test\/render\b)/;
const DOM_GLOBAL_REGEX = /\b(?:window|document|localStorage)\b/;
const UNAWAITED_USER_CLICK_REGEX = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*user\.click\s*\(/;

export function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function validateExclusions(exclusions) {
  for (const exc of exclusions) {
    if (!exc || typeof exc.reason !== 'string' || exc.reason.trim().length === 0) {
      throw new Error(`Exclusion for "${exc?.file ?? 'unknown'}" must include a non-empty reason.`);
    }
  }
}

function buildExcludedSet(exclusions, rule) {
  validateExclusions(exclusions);
  return new Set(
    exclusions
      .filter((e) => !e.rule || e.rule === rule)
      .map((e) => normalizePath(e.file)),
  );
}

/** Quita comentarios de bloque y de línea conservando los saltos de línea (los números de línea no cambian). */
export function stripComments(content) {
  const withoutBlocks = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return withoutBlocks
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n');
}

export function isIntegrationTestFile(filePath) {
  return normalizePath(filePath).endsWith('.integration.test.ts');
}

export function isE2ESpecFile(filePath) {
  const norm = normalizePath(filePath);
  return norm.startsWith('apps/frontend/e2e/') && norm.endsWith('.spec.ts');
}

export function isTestFile(filePath) {
  return /\.(test|spec)\.(ts|tsx|js|mjs)$/.test(normalizePath(filePath));
}

/**
 * @param {Array<{ path: string, content: string }>} files
 * @param {Array<{ file: string, reason: string }>} exclusions
 */
export function findSlowSeedViolations(files, exclusions = DEFAULT_EXCLUSIONS) {
  const excluded = buildExcludedSet(exclusions, 'slow-seed');
  const violations = [];

  for (const file of files) {
    const filePath = normalizePath(file.path);
    if (!isIntegrationTestFile(filePath) || excluded.has(filePath)) continue;

    const lines = stripComments(file.content).split(/\r?\n/);
    lines.forEach((text, index) => {
      if (SLOW_SEED_REGEX.test(text)) {
        violations.push({
          rule: 'slow-seed',
          file: filePath,
          line: index + 1,
          message: `Usa "${SLOW_SEED_NAME}" (siembra lenta) en una prueba de integración. Usa "seedAuthorizationFast" (HU-078).`,
        });
      }
    });
  }

  return violations;
}

/**
 * Prohíbe execSync, execFileSync, spawnSync y child_process en specs E2E (`*.spec.ts`).
 */
export function findE2ESubprocessViolations(files, exclusions = RULE_EXCLUSIONS) {
  const excluded = buildExcludedSet(exclusions, 'e2e-subprocess');
  const violations = [];

  for (const file of files) {
    const filePath = normalizePath(file.path);
    if (!isE2ESpecFile(filePath) || excluded.has(filePath)) continue;

    const lines = stripComments(file.content).split(/\r?\n/);
    lines.forEach((text, index) => {
      if (E2E_SUBPROCESS_REGEX.test(text)) {
        violations.push({
          rule: 'e2e-subprocess',
          file: filePath,
          line: index + 1,
          message:
            'No lances subprocesos (execSync/spawnSync/child_process) en specs E2E; usa el sembrador en proceso.',
        });
      }
    });
  }

  return violations;
}

function extractTimeoutMs(argsText) {
  const parts = argsText.split(',');
  if (parts.length < 2) return null;
  const raw = parts[parts.length - 1].trim().replace(/_/g, '');
  const ms = Number(raw);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Prohíbe waitForTimeout, sleep() y pausas fijas con setTimeout sin `vi.useFakeTimers()`.
 * En unitarias puras se permiten retardos cortos de mock (< 100 ms); en E2E e integración se prohíbe cualquier pausa fija.
 */
export function findFixedPauseViolations(files, exclusions = RULE_EXCLUSIONS) {
  const excluded = buildExcludedSet(exclusions, 'fixed-pause');
  const violations = [];

  for (const file of files) {
    const filePath = normalizePath(file.path);
    if (!isTestFile(filePath) || excluded.has(filePath)) continue;

    const stripped = stripComments(file.content);
    const usesFakeTimers = FAKE_TIMERS_REGEX.test(stripped);
    const lines = stripped.split(/\r?\n/);

    lines.forEach((text, index) => {
      if (WAIT_FOR_TIMEOUT_REGEX.test(text)) {
        violations.push({
          rule: 'fixed-pause',
          file: filePath,
          line: index + 1,
          message: 'Prohibido waitForTimeout(); usa esperas deterministas por señal o aserciones con espera automática.',
        });
      }
      if (!usesFakeTimers && SLEEP_CALL_REGEX.test(text)) {
        violations.push({
          rule: 'fixed-pause',
          file: filePath,
          line: index + 1,
          message: 'Prohibido sleep() en pruebas; usa tiempo simulado (vi.useFakeTimers) o esperas por señal.',
        });
      }
      if (UNAWAITED_USER_CLICK_REGEX.test(text)) {
        violations.push({
          rule: 'fixed-pause',
          file: filePath,
          line: index + 1,
          message:
            'No guardes user.click() en una variable (no espera la petición HTTP en vuelo); haz await user.click() con una promesa controlada (gate/release) y espera a que la mutación termine.',
        });
      }
    });

    if (!usesFakeTimers) {
      const isSlowTier = isE2ESpecFile(filePath) || isIntegrationTestFile(filePath);
      PROMISE_SETTIMEOUT_REGEX.lastIndex = 0;
      let match;
      while ((match = PROMISE_SETTIMEOUT_REGEX.exec(stripped)) !== null) {
        const ms = extractTimeoutMs(match[1]);
        if (isSlowTier || ms === null || ms >= 100) {
          const line = stripped.slice(0, match.index).split('\n').length;
          violations.push({
            rule: 'fixed-pause',
            file: filePath,
            line,
            message:
              'Pausa fija con Promise + setTimeout en prueba; usa vi.useFakeTimers() o espera determinista.',
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Prohíbe el clic al botón «acceder al sistema» en specs E2E que no pertenecen a autenticación.
 */
export function findUiLoginViolations(files, exclusions = RULE_EXCLUSIONS) {
  const excluded = buildExcludedSet(exclusions, 'ui-login');
  const violations = [];

  for (const file of files) {
    const filePath = normalizePath(file.path);
    if (!isE2ESpecFile(filePath) || excluded.has(filePath)) continue;
    if (AUTH_E2E_SPECS.has(path.posix.basename(filePath))) continue;

    const lines = stripComments(file.content).split(/\r?\n/);
    lines.forEach((text, index) => {
      if (UI_LOGIN_REGEX.test(text)) {
        violations.push({
          rule: 'ui-login',
          file: filePath,
          line: index + 1,
          message:
            'No inicies sesión por interfaz fuera de los specs de autenticación; usa loginAsTestUser (sesión por API).',
        });
      }
    });
  }

  return violations;
}

/**
 * Resuelve los archivos del proyecto `node` definidos en `apps/frontend/vitest-projects.json`.
 */
export function resolveFrontendNodeFiles(repoRoot) {
  const root = normalizePath(repoRoot);
  const frontendDir = path.posix.join(root, 'apps', 'frontend');
  const configPath = path.posix.join(frontendDir, 'vitest-projects.json');
  if (!fs.existsSync(configPath)) return new Set();

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const exceptions = new Set((config.nodeExceptions ?? []).map((e) => normalizePath(e.file)));
  const matched = (config.nodeInclude ?? []).flatMap((pattern) =>
    fs.globSync(pattern, { cwd: frontendDir }).map((f) => normalizePath(f)),
  );

  return new Set(matched.filter((f) => !exceptions.has(f)).map((f) => `apps/frontend/${f}`));
}

/**
 * Prohíbe importaciones o referencias a globales de DOM en archivos asignados al proyecto `node`.
 */
export function findDomInNodeViolations(files, exclusions = RULE_EXCLUSIONS, nodeFiles = null) {
  const excluded = buildExcludedSet(exclusions, 'dom-in-node');
  const violations = [];

  for (const file of files) {
    const filePath = normalizePath(file.path);
    if (excluded.has(filePath)) continue;
    if (nodeFiles && !nodeFiles.has(filePath)) continue;

    const lines = stripComments(file.content).split(/\r?\n/);
    lines.forEach((text, index) => {
      if (DOM_IMPORT_REGEX.test(text) || DOM_GLOBAL_REGEX.test(text)) {
        violations.push({
          rule: 'dom-in-node',
          file: filePath,
          line: index + 1,
          message:
            'Archivo del proyecto node usa APIs o librerías de DOM; muévelo a dom o quita la dependencia del DOM.',
        });
      }
    });
  }

  return violations;
}

function walkDir(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.posix.join(normalizePath(dir), entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'generated', '.git', 'dist', 'build', '.cache', 'tmp'].includes(entry.name)) {
        continue;
      }
      walkDir(fullPath, predicate, results);
    } else if (entry.isFile() && predicate(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Lee las pruebas de integración de apps/<app>/src. */
export function scanIntegrationTests(repoRoot) {
  const root = normalizePath(repoRoot);
  const appsDir = path.posix.join(root, 'apps');
  const found = [];
  if (fs.existsSync(appsDir)) {
    for (const app of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (app.isDirectory()) walkDir(path.posix.join(appsDir, app.name, 'src'), isIntegrationTestFile, found);
    }
  }
  return found.map((absPath) => ({
    path: normalizePath(path.posix.relative(root, absPath)),
    content: fs.readFileSync(absPath, 'utf-8'),
  }));
}

/** Lee todas las pruebas unitarias, de integración y E2E del repositorio. */
export function scanAllTests(repoRoot) {
  const root = normalizePath(repoRoot);
  const found = [];
  for (const base of ['apps', 'packages']) {
    const dir = path.posix.join(root, base);
    if (fs.existsSync(dir)) {
      walkDir(dir, isTestFile, found);
    }
  }
  return found.map((absPath) => ({
    path: normalizePath(path.posix.relative(root, absPath)),
    content: fs.readFileSync(absPath, 'utf-8'),
  }));
}

export function runCli(repoRoot = process.cwd()) {
  const allFiles = scanAllTests(repoRoot);
  const nodeFiles = resolveFrontendNodeFiles(repoRoot);

  const violations = [
    ...findSlowSeedViolations(allFiles, DEFAULT_EXCLUSIONS),
    ...findE2ESubprocessViolations(allFiles, RULE_EXCLUSIONS),
    ...findFixedPauseViolations(allFiles, RULE_EXCLUSIONS),
    ...findUiLoginViolations(allFiles, RULE_EXCLUSIONS),
    ...findDomInNodeViolations(allFiles, RULE_EXCLUSIONS, nodeFiles),
  ];

  if (violations.length > 0) {
    const grouped = new Map();
    for (const v of violations) {
      const list = grouped.get(v.rule) ?? [];
      list.push(v);
      grouped.set(v.rule, list);
    }

    console.error(`ERROR: ${violations.length} violación(es) de patrones de pruebas (AGENTS §9):`);
    for (const [rule, list] of grouped.entries()) {
      console.error(`  [${rule}] (${list.length})`);
      for (const v of list) console.error(`    ${v.file}:${v.line} -> ${v.message}`);
    }
    process.exit(1);
  }

  console.log('OK: todas las pruebas cumplen los patrones rápidos (HU-080).');
}

const entry = process.argv[1] ? normalizePath(process.argv[1]) : '';
if (entry.endsWith('check-test-patterns.mjs')) {
  runCli();
}
