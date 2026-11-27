#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPosixPath, toRelativePosix } from './graph.mjs';
import { runSelection } from './select.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Compara las pruebas que fallaron con la selección calculada y devuelve las que faltaron.
 * Función pura; nunca modifica el resultado de las pruebas.
 * @param {{ failedTests: string[], selection: { mode: string, selection?: Record<string, any> }, root?: string }} params
 * @returns {string[]}
 */
export function findInsufficientSelection({ failedTests, selection, root = repoRoot }) {
  if (!failedTests || failedTests.length === 0) return [];
  if (!selection || selection.mode === 'all') return [];

  const sel = selection.selection ?? {};
  const selectedSet = new Set([
    ...(sel.backendUnit ?? []),
    ...(sel.backendIntegration ?? []),
    ...(sel.frontend ?? []),
    ...(sel.shared ?? []),
  ].map((f) => toRelativePosix(root, f)));

  const e2eFull = sel.e2e?.scope === 'full';
  const missing = new Set();

  for (const rawFile of failedTests) {
    const rel = toRelativePosix(root, rawFile);
    if (!rel) continue;
    const isE2e = rel.startsWith('apps/frontend/e2e/') || rel.endsWith('.spec.ts');
    if (isE2e && e2eFull && rel.includes('/e2e/')) continue;
    if (!selectedSet.has(rel)) {
      missing.add(rel);
    }
  }

  return Array.from(missing).sort();
}

/**
 * Extrae los archivos de prueba fallidos desde un informe JSON de Vitest.
 * @param {Record<string, any>} report
 * @param {string} [root]
 * @returns {string[]}
 */
export function extractFailedVitestFiles(report, root = repoRoot) {
  const failed = new Set();
  for (const suite of report?.testResults ?? []) {
    const hasFailedAssertion = Array.isArray(suite.assertionResults)
      ? suite.assertionResults.some((a) => a.status === 'failed')
      : false;
    if (suite.status === 'failed' || hasFailedAssertion) {
      if (suite.name) {
        failed.add(toRelativePosix(root, suite.name));
      }
    }
  }
  return Array.from(failed).sort();
}

/**
 * Extrae los archivos de prueba fallidos desde un informe JSON de Playwright.
 * @param {Record<string, any>} report
 * @param {string} [root]
 * @returns {string[]}
 */
export function extractFailedPlaywrightFiles(report, root = repoRoot) {
  const failed = new Set();

  function walkSuite(suite) {
    for (const spec of suite?.specs ?? []) {
      const specFailed =
        spec.ok === false ||
        (Array.isArray(spec.tests) &&
          spec.tests.some((t) =>
            Array.isArray(t.results) ? t.results.some((r) => r.status === 'failed' || r.status === 'timedOut') : false,
          ));
      if (specFailed && spec.file) {
        const filePosix = toPosixPath(spec.file);
        const normalized = filePosix.startsWith('apps/')
          ? filePosix
          : filePosix.startsWith('e2e/')
            ? `apps/frontend/${filePosix}`
            : toRelativePosix(root, filePosix);
        failed.add(normalized);
      }
    }
    for (const child of suite?.suites ?? []) {
      walkSuite(child);
    }
  }

  for (const suite of report?.suites ?? []) {
    walkSuite(suite);
  }
  return Array.from(failed).sort();
}

function parseArgs(argv) {
  const result = {
    vitest: [],
    playwright: [],
    base: process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/develop',
    summaryPath: process.env.GITHUB_STEP_SUMMARY || '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--vitest') {
      const val = argv[i + 1] ?? '';
      result.vitest.push(...val.split(',').map((s) => s.trim()).filter(Boolean));
      i += 1;
    } else if (arg === '--playwright') {
      const val = argv[i + 1] ?? '';
      result.playwright.push(...val.split(',').map((s) => s.trim()).filter(Boolean));
      i += 1;
    } else if (arg === '--base') {
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        result.base = val;
        i += 1;
      }
    } else if (arg === '--summary') {
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        result.summaryPath = val;
        i += 1;
      }
    }
  }
  return result;
}

function readJsonIfExists(filePath) {
  const abs = path.resolve(repoRoot, filePath);
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failedTests = [];

  for (const reportFile of args.vitest) {
    const json = readJsonIfExists(reportFile);
    if (json) failedTests.push(...extractFailedVitestFiles(json));
  }
  for (const reportFile of args.playwright) {
    const json = readJsonIfExists(reportFile);
    if (json) failedTests.push(...extractFailedPlaywrightFiles(json));
  }

  if (failedTests.length === 0) {
    console.log('[affected-audit] Sin fallos que auditar.');
    return;
  }

  const selection = runSelection({ base: args.base });
  const missing = findInsufficientSelection({ failedTests, selection });

  if (missing.length === 0) {
    console.log('[affected-audit] OK: todas las pruebas fallidas estaban en la selección.');
    return;
  }

  const lines = [
    '### ⚠️ Selección insuficiente',
    '',
    'Las siguientes pruebas fallaron en el CI pero **no** habrían sido seleccionadas por `scripts/ci/affected/select.mjs`:',
    '',
    ...missing.map((file) => `- \`${file}\` (revisar \`scripts/ci/affected/rules.json\` o \`symbols.mjs\`)`),
    '',
    `Motivo de la selección: ${selection.reason}`,
  ];
  const block = `${lines.join('\n')}\n`;
  console.log(block);

  if (args.summaryPath) {
    fs.appendFileSync(args.summaryPath, `\n${block}`, 'utf8');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.warn('[affected-audit] Aviso no bloqueante:', error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 0;
}
