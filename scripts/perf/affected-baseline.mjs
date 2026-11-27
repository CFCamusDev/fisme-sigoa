#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_REPORT_PATH = path.join(repoRoot, 'node_modules', '.cache', 'sigoa-verify', 'last-report.json');
const DEFAULT_OUT_DIR = path.join(repoRoot, 'tmp', 'perf-affected');
const REFERENCE_BASELINE_SECONDS = 550.3;

/**
 * Interpreta los argumentos de la línea de comandos.
 * @param {string[]} argv
 * @returns {{ label: string, reportPath: string, outDir: string }}
 */
export function parseArgs(argv) {
  const result = {
    label: 'baseline',
    reportPath: DEFAULT_REPORT_PATH,
    outDir: DEFAULT_OUT_DIR,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--label') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--label requiere un valor.');
      result.label = value.replace(/[^a-zA-Z0-9._-]+/g, '-');
      i += 1;
    } else if (arg === '--report') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--report requiere una ruta.');
      result.reportPath = path.resolve(repoRoot, value);
      i += 1;
    } else if (arg === '--out-dir') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--out-dir requiere un directorio.');
      result.outDir = path.resolve(repoRoot, value);
      i += 1;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return result;
}

/**
 * Construye una instantánea reproducible de tiempos por paso y grupo a partir de last-report.json.
 * @param {Record<string, any>} report
 * @param {{ label?: string, now?: Date }} [options]
 */
export function buildBaselineSnapshot(report, options = {}) {
  const now = options.now ?? new Date();
  const label = options.label ?? 'baseline';
  const checks = Array.isArray(report.checks) ? report.checks : [];

  const steps = checks.map((check) => {
    const durationMs = typeof check.durationMs === 'number' ? check.durationMs : 0;
    return {
      name: String(check.name ?? ''),
      status: String(check.status ?? 'unknown'),
      durationMs,
      durationSeconds: Number((durationMs / 1000).toFixed(2)),
    };
  });

  const computedTotalMs =
    typeof report.timings?.totalDurationMs === 'number'
      ? report.timings.totalDurationMs
      : report.startedAt && report.completedAt
        ? Math.max(0, new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime())
        : steps.reduce((acc, s) => acc + s.durationMs, 0);

  const totalDurationSeconds = Number((computedTotalMs / 1000).toFixed(2));

  return {
    version: '1.0.0',
    label,
    capturedAt: now.toISOString(),
    branch: report.branch ?? null,
    headSha: report.headSha ?? null,
    mode: report.mode ?? null,
    overallStatus: report.overallStatus ?? null,
    startedAt: report.startedAt ?? null,
    completedAt: report.completedAt ?? null,
    totalDurationMs: computedTotalMs,
    totalDurationSeconds,
    referenceBaselineSeconds: REFERENCE_BASELINE_SECONDS,
    deltaVsReferenceSeconds: Number((totalDurationSeconds - REFERENCE_BASELINE_SECONDS).toFixed(2)),
    groups: report.timings?.groups ?? null,
    steps,
  };
}

function formatTimestampForFile(date) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.reportPath)) {
    console.error(`No se encontró el informe en ${args.reportPath}.`);
    console.error('Ejecuta primero `pnpm verify:pr:full` para generar los tiempos base.');
    process.exitCode = 1;
    return;
  }

  const raw = fs.readFileSync(args.reportPath, 'utf8');
  const report = JSON.parse(raw);
  const now = new Date();
  const snapshot = buildBaselineSnapshot(report, { label: args.label, now });

  fs.mkdirSync(args.outDir, { recursive: true });
  const fileName = `${formatTimestampForFile(now)}-${args.label}.json`;
  const targetPath = path.join(args.outDir, fileName);
  fs.writeFileSync(targetPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  console.log(`Línea base guardada en ${path.relative(repoRoot, targetPath)}`);
  console.log(
    `Modo: ${snapshot.mode ?? 'desconocido'} · Total: ${snapshot.totalDurationSeconds} s · Referencia HU-084: ${snapshot.referenceBaselineSeconds} s`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
