#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Normaliza rutas de archivos de prueba (incluyendo separadores de Windows) sin usar path del anfitrión.
 * @param {string} rawPath
 * @returns {string}
 */
export function normalizeTestFilePath(rawPath) {
  if (!rawPath) return '';
  const forward = String(rawPath).replace(/\\/g, '/').replace(/^\.\//, '');
  const e2eMarker = '/e2e/';
  const e2eIdx = forward.lastIndexOf(e2eMarker);
  if (e2eIdx !== -1) {
    return forward.slice(e2eIdx + 1);
  }
  const srcMarker = '/src/';
  const srcIdx = forward.lastIndexOf(srcMarker);
  if (srcIdx !== -1) {
    return forward.slice(srcIdx + 1);
  }
  return forward;
}

/**
 * Extrae la lista de identificadores de prueba desde un JSON de Playwright (`--list --reporter=json` o `merge-reports --reporter=json`).
 * @param {object} report
 * @returns {string[]}
 */
export function extractPlaywrightTests(report) {
  const entries = [];

  function walkSuite(suite, ancestors) {
    if (!suite || typeof suite !== 'object') return;
    const title = typeof suite.title === 'string' ? suite.title.trim() : '';
    const isFileSuite =
      title !== '' &&
      (title.endsWith('.spec.ts') ||
        title.endsWith('.test.ts') ||
        (typeof suite.file === 'string' && title === suite.file));
    const nextAncestors = title && !isFileSuite ? [...ancestors, title] : ancestors;

    if (Array.isArray(suite.specs)) {
      for (const spec of suite.specs) {
        const file = normalizeTestFilePath(spec.file || suite.file || '');
        const fullTitle = [...nextAncestors, spec.title].filter(Boolean).join(' > ');
        const count = Array.isArray(spec.tests) && spec.tests.length > 0 ? spec.tests.length : 1;
        for (let i = 0; i < count; i += 1) {
          entries.push(`${file} :: ${fullTitle}`);
        }
      }
    }

    if (Array.isArray(suite.suites)) {
      for (const child of suite.suites) {
        walkSuite(child, nextAncestors);
      }
    }
  }

  for (const topSuite of report?.suites ?? []) {
    walkSuite(topSuite, []);
  }

  return entries;
}

/**
 * Extrae la lista única de archivos de prueba desde un JSON de Vitest (`vitest list --json` o `--reporter=json`).
 * Vitest reparte los shards por archivo y `vitest list` no expande `describe.each`/`it.each` ni interpolaciones,
 * por lo que la completitud de Vitest se verifica a nivel de archivo normalizado.
 * @param {object | Array<object>} report
 * @returns {string[]}
 */
export function extractVitestTests(report) {
  const files = new Set();
  if (Array.isArray(report)) {
    for (const item of report) {
      const file = normalizeTestFilePath(item?.file ?? '');
      if (file) files.add(file);
    }
    return [...files];
  }

  for (const testFile of report?.testResults ?? []) {
    const file = normalizeTestFilePath(testFile?.name ?? '');
    if (file && Array.isArray(testFile.assertionResults) && testFile.assertionResults.length > 0) {
      files.add(file);
    }
  }
  return [...files];
}

/**
 * Compara la lista esperada contra lo ejecutado en shards (+ fuentes extra opcionales).
 * @param {string[]} expected
 * @param {string[]} actual
 * @param {string[]} [extra]
 * @returns {{ ok: boolean, expectedCount: number, actualCount: number, repeated: string[], omitted: string[] }}
 */
export function checkShardCompleteness(expected, actual, extra = []) {
  const combined = [...actual, ...extra];
  const counts = new Map();
  for (const item of combined) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }

  const repeated = [];
  for (const [item, count] of counts.entries()) {
    if (count > 1) repeated.push(item);
  }

  const omitted = [];
  for (const item of expected) {
    if (!counts.has(item)) omitted.push(item);
  }

  return {
    ok: repeated.length === 0 && omitted.length === 0,
    expectedCount: expected.length,
    actualCount: combined.length,
    repeated,
    omitted,
  };
}

function parseArgs(argv) {
  const result = { tool: '', expected: '', actual: '', extra: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tool') {
      result.tool = argv[++i] ?? '';
    } else if (arg === '--expected') {
      result.expected = argv[++i] ?? '';
    } else if (arg === '--actual') {
      result.actual = argv[++i] ?? '';
    } else if (arg === '--extra') {
      const raw = argv[++i] ?? '';
      if (raw) {
        result.extra.push(...raw.split(',').map((item) => item.trim()).filter(Boolean));
      }
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  if (result.tool !== 'playwright' && result.tool !== 'vitest') {
    throw new Error('--tool debe ser "playwright" o "vitest".');
  }
  if (!result.expected || !result.actual) {
    throw new Error('--expected y --actual son obligatorios.');
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const extractor = args.tool === 'playwright' ? extractPlaywrightTests : extractVitestTests;

  const expectedJson = JSON.parse(fs.readFileSync(args.expected, 'utf8'));
  const actualJson = JSON.parse(fs.readFileSync(args.actual, 'utf8'));
  const extraEntries = [];
  for (const extraPath of args.extra) {
    if (fs.existsSync(extraPath)) {
      const extraJson = JSON.parse(fs.readFileSync(extraPath, 'utf8'));
      extraEntries.push(...extractor(extraJson));
    }
  }

  const expected = extractor(expectedJson);
  const actual = extractor(actualJson);
  const result = checkShardCompleteness(expected, actual, extraEntries);

  if (!result.ok) {
    console.error(
      `Completitud de shards (${args.tool}) fallida: esperadas=${result.expectedCount}, ejecutadas=${result.actualCount}`,
    );
    if (result.repeated.length > 0) {
      console.error(`Repetidas (${result.repeated.length}):\n  - ${result.repeated.join('\n  - ')}`);
    }
    if (result.omitted.length > 0) {
      console.error(`Omitidas (${result.omitted.length}):\n  - ${result.omitted.join('\n  - ')}`);
    }
    process.exit(1);
  }

  console.log(
    `OK: Completitud de shards (${args.tool}) verificada (${result.actualCount}/${result.expectedCount} pruebas, sin repetidas ni omitidas).`,
  );
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  main();
}
