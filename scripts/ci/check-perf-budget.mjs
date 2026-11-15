#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { slowestTests } from './ci-summary.mjs';

const VALID_TIERS = new Set(['unit', 'integration', 'e2e']);

export function normalizePath(p) {
  return String(p ?? '').replace(/\\/g, '/');
}

/**
 * Normaliza la ruta de un archivo de prueba a relativa a la raíz del repositorio cuando sea posible.
 */
export function normalizeRepoRelativePath(rawFile, repoRoot = process.cwd()) {
  const norm = normalizePath(rawFile).replace(/^\.\//, '');
  if (!norm) return '';

  const appsMatch = norm.match(/(?:^|\/)(apps\/.+)$/);
  if (appsMatch) return appsMatch[1];

  const pkgsMatch = norm.match(/(?:^|\/)(packages\/.+)$/);
  if (pkgsMatch) return pkgsMatch[1];

  const rootNorm = normalizePath(repoRoot).replace(/\/$/, '');
  if (rootNorm && norm.startsWith(`${rootNorm}/`)) {
    return norm.slice(rootNorm.length + 1);
  }

  // Playwright suele reportar `spec.file` relativo a `apps/frontend/e2e`
  if (norm.endsWith('.spec.ts') && !norm.includes('/')) {
    return `apps/frontend/e2e/${norm}`;
  }
  if (norm.endsWith('.spec.ts') && !norm.startsWith('apps/')) {
    return `apps/frontend/e2e/${norm.replace(/^e2e\//, '')}`;
  }

  return norm;
}

export function inferTierFromFile(filePath) {
  const norm = normalizePath(filePath);
  if (norm.endsWith('.integration.test.ts')) return 'integration';
  if (norm.endsWith('.spec.ts') || norm.endsWith('.spec.tsx')) return 'e2e';
  return 'unit';
}

export function extractTestsFromReports(vitestReports = [], playwrightReports = [], repoRoot = process.cwd()) {
  const raw = slowestTests(vitestReports, playwrightReports, Number.POSITIVE_INFINITY);
  return raw.map((item) => ({
    tool: item.tool,
    file: normalizeRepoRelativePath(item.file, repoRoot),
    title: String(item.title ?? ''),
    durationMs: item.durationMs,
  }));
}

function matchesException(testItem, exc) {
  const excFile = normalizePath(exc.file);
  if (testItem.file !== excFile) return false;
  if (!exc.test) return true;
  return testItem.title === exc.test || testItem.title.endsWith(exc.test);
}

/**
 * Evalúa presupuestos por prueba para un nivel (`unit`, `integration`, `e2e`).
 * Falla si una prueba supera su presupuesto sin excepción, si supera el tope de su excepción,
 * si una excepción listada ya no existe en el informe, o si hay duraciones negativas/inválidas.
 */
export function checkPerfBudget({ tier, tests, budget }) {
  if (!VALID_TIERS.has(tier)) {
    throw new Error(`Invalid tier "${tier}". Expected one of: unit, integration, e2e.`);
  }

  const limitDefault = Number(budget?.perTest?.[tier]);
  if (!Number.isFinite(limitDefault) || limitDefault <= 0) {
    throw new Error(`Missing or invalid perTest budget for tier "${tier}".`);
  }

  const exceptions = Array.isArray(budget?.exceptions) ? budget.exceptions : [];
  const tierExceptions = exceptions.filter((exc) => (exc.tier ?? inferTierFromFile(exc.file)) === tier);

  const violations = [];

  for (const exc of tierExceptions) {
    if (!exc || typeof exc.file !== 'string' || typeof exc.reason !== 'string' || exc.reason.trim() === '') {
      violations.push({
        kind: 'invalid-exception',
        file: String(exc?.file ?? ''),
        test: String(exc?.test ?? ''),
        message: 'Toda excepción en perf-budget.json debe indicar file y reason no vacío.',
      });
      continue;
    }

    const excMs = Number(exc.ms);
    if (!Number.isFinite(excMs) || excMs <= 0) {
      violations.push({
        kind: 'invalid-exception',
        file: normalizePath(exc.file),
        test: String(exc.test ?? ''),
        message: `La excepción para "${exc.file}" debe tener un tope "ms" positivo.`,
      });
      continue;
    }

    const matched = tests.some((t) => matchesException(t, exc));
    if (!matched) {
      violations.push({
        kind: 'stale-exception',
        file: normalizePath(exc.file),
        test: String(exc.test ?? ''),
        message: `Excepción obsoleta: no se encontró en el informe "${exc.file}"${exc.test ? ` (${exc.test})` : ''}.`,
      });
    }
  }

  for (const item of tests) {
    const duration = Number(item.durationMs);
    if (!Number.isFinite(duration) || duration < 0) {
      violations.push({
        kind: 'invalid-duration',
        file: item.file,
        test: item.title,
        durationMs: item.durationMs,
        message: `Duración inválida (${item.durationMs}) en "${item.file}" > "${item.title}".`,
      });
      continue;
    }

    const matchingExc = tierExceptions.find((exc) => matchesException(item, exc));
    const maxMs = matchingExc ? Number(matchingExc.ms) : limitDefault;

    if (duration > maxMs) {
      violations.push({
        kind: matchingExc ? 'exception-exceeded' : 'budget-exceeded',
        file: item.file,
        test: item.title,
        durationMs: duration,
        limitMs: maxMs,
        message: matchingExc
          ? `${item.file} > ${item.title} tardó ${duration.toFixed(0)} ms y supera su excepción de ${maxMs} ms.`
          : `${item.file} > ${item.title} tardó ${duration.toFixed(0)} ms y supera el presupuesto de ${tier} (${maxMs} ms).`,
      });
    }
  }

  return { ok: violations.length === 0, tier, checked: tests.length, violations };
}

function readJsonFiles(pathsList) {
  const reports = [];
  for (const filePath of pathsList) {
    if (!filePath) continue;
    const resolved = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`No se encontró el informe: ${filePath}`);
    }
    reports.push(JSON.parse(fs.readFileSync(resolved, 'utf-8')));
  }
  return reports;
}

export function parseArgs(argv) {
  const args = {
    tier: '',
    vitest: [],
    playwright: [],
    budget: 'scripts/ci/perf-budget.json',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tier' && argv[i + 1]) {
      args.tier = argv[++i];
    } else if (arg === '--vitest' && argv[i + 1]) {
      args.vitest.push(
        ...argv[++i]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (arg === '--playwright' && argv[i + 1]) {
      args.playwright.push(
        ...argv[++i]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (arg === '--budget' && argv[i + 1]) {
      args.budget = argv[++i];
    }
  }

  return args;
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const budgetPath = path.resolve(process.cwd(), args.budget);
  const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf-8'));
  const vitestReports = readJsonFiles(args.vitest);
  const playwrightReports = readJsonFiles(args.playwright);
  const tests = extractTestsFromReports(vitestReports, playwrightReports, process.cwd());

  const result = checkPerfBudget({ tier: args.tier, tests, budget });

  if (!result.ok) {
    console.error(`ERROR: ${result.violations.length} violación(es) de presupuesto por prueba (${args.tier}):`);
    for (const v of result.violations) {
      console.error(`  - ${v.message}`);
    }
    process.exit(1);
  }

  console.log(
    `OK: ${result.checked} prueba(s) de "${args.tier}" dentro del presupuesto (máx. ${budget.perTest[args.tier]} ms).`,
  );
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntry) {
  runCli();
}
