#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

/**
 * Las pruebas de integración usan la siembra rápida (HU-078). Este script falla si un archivo
 * `*.integration.test.ts` importa o llama a la siembra lenta de producción.
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

// \b no cruza hacia "Fast": seedAuthorizationFast no coincide.
const SLOW_SEED_REGEX = new RegExp(`\\b${SLOW_SEED_NAME}\\b`);

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

/**
 * @param {Array<{ path: string, content: string }>} files
 * @param {Array<{ file: string, reason: string }>} exclusions
 */
export function findSlowSeedViolations(files, exclusions = DEFAULT_EXCLUSIONS) {
  validateExclusions(exclusions);
  const excluded = new Set(exclusions.map((e) => normalizePath(e.file)));
  const violations = [];

  for (const file of files) {
    const filePath = normalizePath(file.path);
    if (!isIntegrationTestFile(filePath) || excluded.has(filePath)) continue;

    const lines = stripComments(file.content).split(/\r?\n/);
    lines.forEach((text, index) => {
      if (SLOW_SEED_REGEX.test(text)) {
        violations.push({
          file: filePath,
          line: index + 1,
          message: `Usa "${SLOW_SEED_NAME}" (siembra lenta) en una prueba de integración. Usa "seedAuthorizationFast" (HU-078).`,
        });
      }
    });
  }

  return violations;
}

function walkDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.posix.join(normalizePath(dir), entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'generated', '.git', 'dist', 'build', '.cache', 'tmp'].includes(entry.name)) continue;
      walkDir(fullPath, results);
    } else if (entry.isFile() && isIntegrationTestFile(entry.name)) {
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
      if (app.isDirectory()) walkDir(path.posix.join(appsDir, app.name, 'src'), found);
    }
  }
  return found.map((absPath) => ({
    path: normalizePath(path.posix.relative(root, absPath)),
    content: fs.readFileSync(absPath, 'utf-8'),
  }));
}

export function runCli() {
  const files = scanIntegrationTests(process.cwd());
  const violations = findSlowSeedViolations(files, DEFAULT_EXCLUSIONS);

  if (violations.length > 0) {
    console.error(`ERROR: ${violations.length} uso(s) de la siembra lenta en pruebas de integración (AGENTS §9):`);
    for (const v of violations) console.error(`  ${v.file}:${v.line} -> ${v.message}`);
    process.exit(1);
  }

  console.log('OK: las pruebas de integración usan la siembra rápida.');
}

const entry = process.argv[1] ? normalizePath(process.argv[1]) : '';
if (entry.endsWith('check-test-patterns.mjs')) {
  runCli();
}
