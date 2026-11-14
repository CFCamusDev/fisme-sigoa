#!/usr/bin/env node
import { execFile as execFileCb } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { jobMinutes } from './ci-timing.mjs';

const execFile = promisify(execFileCb);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const DEFAULT_BASELINE_PATH = path.join(repoRoot, 'scripts', 'perf', 'baseline-2026-11-14.json');

/**
 * Devuelve las N pruebas más lentas combinando informes JSON de Vitest y Playwright.
 * @param {Array<object>} vitestReports
 * @param {Array<object>} playwrightReports
 * @param {number} [limit=10]
 */
export function slowestTests(vitestReports, playwrightReports, limit = 10) {
  const items = [];

  for (const report of vitestReports) {
    for (const testFile of report?.testResults ?? []) {
      const file = String(testFile.name ?? '').replace(/\\/g, '/');
      for (const assertion of testFile.assertionResults ?? []) {
        items.push({
          tool: 'vitest',
          file,
          title:
            assertion.fullName ??
            [...(assertion.ancestorTitles ?? []), assertion.title].filter(Boolean).join(' > '),
          durationMs: Number(assertion.duration ?? 0),
        });
      }
    }
  }

  for (const report of playwrightReports) {
    function walkSuite(suite, ancestors) {
      if (!suite || typeof suite !== 'object') return;
      const title = typeof suite.title === 'string' ? suite.title.trim() : '';
      const isFileSuite =
        title !== '' &&
        (title.endsWith('.spec.ts') ||
          title.endsWith('.test.ts') ||
          (typeof suite.file === 'string' && title === suite.file));
      const nextAncestors = title && !isFileSuite ? [...ancestors, title] : ancestors;

      for (const spec of suite.specs ?? []) {
        const file = String(spec.file || suite.file || '').replace(/\\/g, '/');
        const fullTitle = [...nextAncestors, spec.title].filter(Boolean).join(' > ');
        for (const testItem of spec.tests ?? []) {
          const results = Array.isArray(testItem.results) ? testItem.results : [];
          const durationMs = results.reduce((sum, r) => sum + Number(r.duration ?? 0), 0);
          items.push({
            tool: 'playwright',
            file,
            title: fullTitle,
            durationMs,
          });
        }
      }

      for (const child of suite.suites ?? []) {
        walkSuite(child, nextAncestors);
      }
    }

    for (const top of report?.suites ?? []) {
      walkSuite(top, []);
    }
  }

  return items.sort((a, b) => b.durationMs - a.durationMs).slice(0, limit);
}

/**
 * Extrae las pruebas de Playwright que pasaron solo después de reintentar.
 * @param {Array<object>} playwrightReports
 */
export function flakyTests(playwrightReports) {
  const flaky = [];

  for (const report of playwrightReports) {
    function walkSuite(suite, ancestors) {
      if (!suite || typeof suite !== 'object') return;
      const title = typeof suite.title === 'string' ? suite.title.trim() : '';
      const isFileSuite =
        title !== '' &&
        (title.endsWith('.spec.ts') ||
          title.endsWith('.test.ts') ||
          (typeof suite.file === 'string' && title === suite.file));
      const nextAncestors = title && !isFileSuite ? [...ancestors, title] : ancestors;

      for (const spec of suite.specs ?? []) {
        const file = String(spec.file || suite.file || '').replace(/\\/g, '/');
        const fullTitle = [...nextAncestors, spec.title].filter(Boolean).join(' > ');
        for (const testItem of spec.tests ?? []) {
          const results = Array.isArray(testItem.results) ? testItem.results : [];
          if (results.length > 1) {
            const last = results[results.length - 1];
            const hadFailure = results.slice(0, -1).some((r) => r.status !== 'passed');
            if (last?.status === 'passed' && hadFailure) {
              const durationMs = results.reduce((sum, r) => sum + Number(r.duration ?? 0), 0);
              flaky.push({
                file,
                title: fullTitle,
                attempts: results.length,
                durationMs,
              });
            }
          }
        }
      }

      for (const child of suite.suites ?? []) {
        walkSuite(child, nextAncestors);
      }
    }

    for (const top of report?.suites ?? []) {
      walkSuite(top, []);
    }
  }

  return flaky;
}

/**
 * Renderiza una tabla Markdown con los tiempos de cada job frente a la línea base.
 * @param {Array<object>} jobs
 * @param {object | null} [baseline]
 */
export function renderJobTimes(jobs, baseline = null) {
  const lines = ['## Tiempos por job del CI', '', '| Job | Estado | Duración | Min. facturados |', '|---|---|---|---|'];
  let totalBilled = 0;
  let totalExact = 0;

  for (const job of jobs) {
    if (job.conclusion === 'skipped' && !job.started_at) continue;
    const start = Date.parse(job.started_at ?? '');
    const end = Date.parse(job.completed_at ?? '');
    const seconds = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, (end - start) / 1000) : 0;
    const { exactMinutes, billedMinutes } = jobMinutes(seconds);
    totalExact += exactMinutes;
    totalBilled += billedMinutes;
    lines.push(
      `| ${job.name} | ${job.conclusion ?? '—'} | ${seconds.toFixed(1)} s | ${billedMinutes} min |`,
    );
  }

  lines.push('');
  lines.push(`- Suma exacta: **${totalExact.toFixed(2)} min** · Facturados: **${totalBilled} min**`);
  if (baseline?.ci) {
    lines.push(
      `- Línea base (${baseline.date}): flujo **${baseline.ci.totalSeconds} s**, máquina **${baseline.ci.billedMachineMinutes} min**`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderTestsSummary(vitestReports, playwrightReports) {
  const lines = ['## 10 pruebas más lentas', '', '| Herramienta | Prueba | Duración |', '|---|---|---|'];
  const top10 = slowestTests(vitestReports, playwrightReports, 10);
  if (top10.length === 0) {
    lines.push('| — | Sin resultados | — |');
  } else {
    for (const item of top10) {
      lines.push(`| ${item.tool} | ${item.title} | ${(item.durationMs / 1000).toFixed(2)} s |`);
    }
  }

  lines.push('');
  lines.push('## Pruebas que pasaron solo al reintentar');
  const flaky = flakyTests(playwrightReports);
  if (flaky.length === 0) {
    lines.push('');
    lines.push('Ninguna prueba requirió reintento.');
  } else {
    lines.push('');
    lines.push('| Prueba | Intentos | Duración total |');
    lines.push('|---|---|---|');
    for (const item of flaky) {
      lines.push(`| ${item.title} | ${item.attempts} | ${(item.durationMs / 1000).toFixed(2)} s |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function parseArgs(argv) {
  const result = {
    mode: '',
    vitest: [],
    playwright: [],
    runId: '',
    summaryFile: process.env.GITHUB_STEP_SUMMARY || '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') {
      result.mode = argv[++i] ?? '';
    } else if (arg === '--vitest') {
      const raw = argv[++i] ?? '';
      result.vitest.push(...raw.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg === '--playwright') {
      const raw = argv[++i] ?? '';
      result.playwright.push(...raw.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg === '--run-id') {
      result.runId = argv[++i] ?? '';
    } else if (arg === '--summary-file') {
      result.summaryFile = argv[++i] ?? '';
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  if (result.mode !== 'tests' && result.mode !== 'jobs') {
    throw new Error('--mode debe ser "tests" o "jobs".');
  }
  return result;
}

function writeSummary(markdown, summaryFile) {
  if (summaryFile) {
    fs.appendFileSync(summaryFile, `${markdown}\n`, 'utf8');
  } else {
    console.log(markdown);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'tests') {
    const vitestReports = args.vitest
      .filter((p) => fs.existsSync(p))
      .map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
    const playwrightReports = args.playwright
      .filter((p) => fs.existsSync(p))
      .map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
    writeSummary(renderTestsSummary(vitestReports, playwrightReports), args.summaryFile);
    return;
  }

  const runId = args.runId || process.env.GITHUB_RUN_ID;
  if (!runId) {
    throw new Error('--run-id o GITHUB_RUN_ID son obligatorios en modo jobs.');
  }
  const res = await execFile('gh', [
    'api',
    '--paginate',
    `/repos/{owner}/{repo}/actions/runs/${runId}/jobs?filter=latest&per_page=100`,
  ]);
  const data = JSON.parse(res.stdout);
  const baseline = fs.existsSync(DEFAULT_BASELINE_PATH)
    ? JSON.parse(fs.readFileSync(DEFAULT_BASELINE_PATH, 'utf8'))
    : null;
  writeSummary(renderJobTimes(data.jobs ?? [], baseline), args.summaryFile);
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
