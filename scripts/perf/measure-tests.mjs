#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');

/**
 * Grupos medibles. `command` se ejecuta con shell desde la raíz del repositorio.
 */
export const GROUPS = [
  { id: 'backend-unit', name: 'Unitarias backend', command: 'pnpm --filter backend test:unit' },
  {
    id: 'backend-integration',
    name: 'Integración backend',
    command: 'pnpm --filter backend test:integration',
  },
  { id: 'frontend', name: 'Frontend', command: 'pnpm --filter frontend test' },
  { id: 'shared', name: 'Shared', command: 'pnpm --filter @sigoa/shared test' },
  {
    id: 'pdf',
    name: 'PDF con Chromium',
    command: 'pnpm --filter backend exec vitest run --project integration src/shared/pdf',
  },
  { id: 'e2e', name: 'E2E Playwright', command: 'pnpm test:e2e' },
  {
    id: 'verify-full-repeat-3',
    name: 'verify:pr:full --repeat 3',
    command: 'pnpm verify:pr:full --repeat 3',
  },
];

/**
 * Interpreta los argumentos de la línea de comandos.
 * @param {string[]} argv
 * @returns {{ only: string[] | null, outDir: string | null }}
 */
export function parseArgs(argv) {
  const result = { only: null, outDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--only') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--only requiere uno o más grupos separados por coma.');
      }
      const ids = value.split(',').map((item) => item.trim());
      const known = new Set(GROUPS.map((group) => group.id));
      const unknown = ids.filter((id) => !known.has(id));
      if (unknown.length > 0) {
        throw new Error(
          `Grupo desconocido: ${unknown.join(', ')}. Válidos: ${[...known].join(', ')}.`,
        );
      }
      result.only = ids;
      i += 1;
    } else if (arg === '--out-dir') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--out-dir requiere una ruta.');
      result.outDir = value;
      i += 1;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return result;
}

/**
 * Extrae el número de pruebas aprobadas de la salida de Vitest o Playwright.
 * @param {string} output
 * @returns {number | null}
 */
export function parseTestCount(output) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '');
  const vitest = clean.match(/^\s*Tests\s+(?:\d+ failed \| )?(\d+) passed/m);
  if (vitest) return Number(vitest[1]);
  const playwright = clean.match(/^\s*(\d+) passed/m);
  if (playwright) return Number(playwright[1]);
  return null;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Compara una medición con la línea base.
 * @param {{ id: string, seconds: number, tests: number | null, ok: boolean }} measured
 * @param {{ seconds: number, tests: number | null } | undefined} baseline
 */
export function compareWithBaseline(measured, baseline) {
  if (!baseline) {
    return { baselineSeconds: null, deltaSeconds: null, speedup: null, testsDelta: null };
  }
  const deltaSeconds = round(measured.seconds - baseline.seconds);
  const speedup = measured.seconds > 0 ? round(baseline.seconds / measured.seconds) : null;
  const testsDelta =
    measured.tests !== null && baseline.tests !== null ? measured.tests - baseline.tests : null;
  return { baselineSeconds: baseline.seconds, deltaSeconds, speedup, testsDelta };
}

/**
 * Construye el informe comparado con la línea base.
 * @param {Array<{ id: string, name: string, seconds: number, tests: number | null, ok: boolean }>} measurements
 * @param {{ date: string, groups: Record<string, { seconds: number, tests: number | null }> }} baseline
 * @param {string} generatedAt
 */
export function buildReport(measurements, baseline, generatedAt) {
  return {
    generatedAt,
    baselineDate: baseline.date,
    groups: measurements.map((measured) => ({
      ...measured,
      ...compareWithBaseline(measured, baseline.groups[measured.id]),
    })),
  };
}

function cell(value) {
  return value === null || value === undefined ? '—' : String(value);
}

/**
 * Renderiza el informe en Markdown.
 * @param {ReturnType<typeof buildReport>} report
 */
export function renderMarkdown(report) {
  const lines = [
    '# Informe de tiempos de pruebas',
    '',
    `Generado: ${report.generatedAt} · Línea base: ${report.baselineDate}`,
    '',
    '| Grupo | Estado | Segundos | Línea base (s) | Diferencia (s) | Veces más rápido | Pruebas | Pruebas vs base |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const group of report.groups) {
    lines.push(
      `| ${group.name} | ${group.ok ? 'OK' : 'FALLÓ'} | ${group.seconds} | ${cell(group.baselineSeconds)} | ${cell(group.deltaSeconds)} | ${cell(group.speedup)} | ${cell(group.tests)} | ${cell(group.testsDelta)} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function runGroup(group) {
  const started = process.hrtime.bigint();
  const result = spawnSync(group.command, {
    cwd: repoRoot,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const seconds = round(Number(process.hrtime.bigint() - started) / 1e9);
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return {
    id: group.id,
    name: group.name,
    seconds,
    tests: parseTestCount(output),
    ok: result.status === 0,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseline = JSON.parse(
    fs.readFileSync(path.join(scriptDir, 'baseline-2026-11-10.json'), 'utf8'),
  );
  const selected = GROUPS.filter((group) => !args.only || args.only.includes(group.id));
  const measurements = [];
  for (const group of selected) {
    console.log(`Midiendo ${group.name}...`);
    const measured = runGroup(group);
    console.log(`  ${measured.ok ? 'OK' : 'FALLÓ'} en ${measured.seconds} s`);
    measurements.push(measured);
  }
  const report = buildReport(measurements, baseline, new Date().toISOString());
  const outDir = args.outDir ? path.resolve(args.outDir) : path.join(repoRoot, 'tmp', 'perf');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'report.md'), renderMarkdown(report));
  console.log(`Informe escrito en ${path.join(outDir, 'report.md')}`);
  process.exitCode = measurements.every((item) => item.ok) ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
