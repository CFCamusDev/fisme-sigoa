#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Interpreta los argumentos: --runs (3 por defecto) y --workers (3 por defecto).
 * @param {string[]} argv
 * @returns {{ runs: number, workers: number }}
 */
export function parseArgs(argv) {
  const result = { runs: 3, workers: 3 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg !== '--runs' && arg !== '--workers') throw new Error(`Argumento desconocido: ${arg}`);
    const raw = argv[i + 1];
    if (raw === undefined || !/^[0-9]+$/.test(raw) || Number(raw) < 1 || Number(raw) > 32) {
      throw new Error(`${arg} debe ser un entero entre 1 y 32 (recibido: '${raw ?? ''}').`);
    }
    result[arg === '--runs' ? 'runs' : 'workers'] = Number(raw);
    i += 1;
  }
  return result;
}

/**
 * Evalúa las estadísticas del reporte JSON de Playwright. Cualquier fallo cuenta, incluso uno que
 * pasó al reintentar (flaky), y no se admiten pruebas omitidas ni interrumpidas (AGENTS §9).
 * @param {{ expected?: number, unexpected?: number, flaky?: number, skipped?: number }} stats
 * @returns {{ ok: boolean, reasons: string[], passed: number }}
 */
export function evaluateRun(stats) {
  const reasons = [];
  const { expected = 0, unexpected = 0, flaky = 0, skipped = 0 } = stats ?? {};
  if (unexpected > 0) reasons.push(`${unexpected} prueba(s) fallaron`);
  if (flaky > 0) reasons.push(`${flaky} prueba(s) inestables (pasaron solo al reintentar)`);
  if (skipped > 0) reasons.push(`${skipped} prueba(s) omitidas`);
  if (expected === 0) reasons.push('no se ejecutó ninguna prueba');
  return { ok: reasons.length === 0, reasons, passed: expected };
}

function runOnce(index, workers, outputFile) {
  const result = spawnSync(
    'pnpm --filter frontend exec playwright test --retries=0 --reporter=json',
    {
      cwd: repoRoot,
      shell: true,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      env: {
        ...process.env,
        E2E_WORKERS: String(workers),
        PLAYWRIGHT_JSON_OUTPUT_NAME: outputFile,
      },
    },
  );
  let stats;
  try {
    stats = JSON.parse(fs.readFileSync(outputFile, 'utf8')).stats;
  } catch {
    return {
      ok: false,
      reasons: [`sin reporte JSON: ${(result.stderr || '').slice(-300)}`],
      passed: 0,
    };
  }
  const evaluation = evaluateRun({
    expected: stats.expected,
    unexpected: stats.unexpected,
    flaky: stats.flaky,
    skipped: stats.skipped,
  });
  console.log(
    `Ejecución ${index}: ${evaluation.ok ? 'OK' : 'FALLÓ'} (${evaluation.passed} pruebas, ${(
      stats.duration / 1000
    ).toFixed(1)} s)${evaluation.reasons.length ? ` — ${evaluation.reasons.join('; ')}` : ''}`,
  );
  return evaluation;
}

function main() {
  const { runs, workers } = parseArgs(process.argv.slice(2));
  const prepare = spawnSync('pnpm build:shared && pnpm db:generate', {
    cwd: repoRoot,
    shell: true,
    stdio: 'inherit',
  });
  if (prepare.status !== 0) {
    process.exitCode = 1;
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigoa-e2e-stability-'));
  let failures = 0;
  try {
    console.log(`Estabilidad E2E: ${runs} ejecuciones seguidas con ${workers} workers`);
    for (let i = 1; i <= runs; i += 1) {
      const evaluation = runOnce(i, workers, path.join(dir, `run-${i}.json`));
      if (!evaluation.ok) failures += 1;
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(
    failures === 0
      ? 'Estable: todas las ejecuciones pasaron.'
      : `Inestable: ${failures} ejecución(es) fallaron.`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
