#!/usr/bin/env node
import { execFile as execFileCb } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const DEFAULT_BASELINE_PATH = path.join(repoRoot, 'scripts', 'perf', 'baseline-2026-11-14.json');

/**
 * Interpreta los argumentos de la línea de comandos.
 * @param {string[]} argv
 * @returns {{ runs: number, json: boolean, workflow: string, baseBranch: string }}
 */
export function parseArgs(argv) {
  const result = {
    runs: 5,
    json: false,
    workflow: 'pr-checks.yml',
    baseBranch: 'develop',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--runs') {
      const raw = argv[i + 1];
      if (!raw || raw.startsWith('--')) {
        throw new Error('--runs requiere un número entero entre 1 y 50.');
      }
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
        throw new Error(`--runs debe ser un entero entre 1 y 50 (recibido: ${raw}).`);
      }
      result.runs = parsed;
      i += 1;
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg === '--workflow') {
      const raw = argv[i + 1];
      if (!raw || raw.startsWith('--')) throw new Error('--workflow requiere un nombre.');
      result.workflow = raw;
      i += 1;
    } else if (arg === '--base') {
      const raw = argv[i + 1];
      if (!raw || raw.startsWith('--')) throw new Error('--base requiere una rama.');
      result.baseBranch = raw;
      i += 1;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }

  return result;
}

/**
 * Calcula los minutos exactos y facturados (redondeando hacia arriba cada job) a partir de segundos.
 * @param {number} durationSeconds
 * @returns {{ exactMinutes: number, billedMinutes: number }}
 */
export function jobMinutes(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { exactMinutes: 0, billedMinutes: 0 };
  }
  return {
    exactMinutes: durationSeconds / 60,
    billedMinutes: Math.ceil(durationSeconds / 60),
  };
}

function secondsBetween(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, (end - start) / 1000);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function computeStats(values, rounder = round1) {
  if (values.length === 0) return { avg: 0, min: 0, max: 0 };
  let sum = 0;
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    avg: rounder(sum / values.length),
    min: rounder(min),
    max: rounder(max),
  };
}

function extractBaseBranch(run) {
  if (typeof run?.baseBranch === 'string') return run.baseBranch;
  return run?.pull_requests?.[0]?.base?.ref ?? null;
}

/**
 * Agrega métricas de cola, duración y minutos de máquina por flujo, job y paso.
 * @param {Array<object>} runsWithJobs
 * @param {{ baseBranch?: string }} [options]
 */
export function aggregateRuns(runsWithJobs, options = {}) {
  const baseBranch = options.baseBranch ?? 'develop';
  const filtered = runsWithJobs.filter((run) => extractBaseBranch(run) === baseBranch);

  const workflowDurations = [];
  const exactMachineList = [];
  const billedMachineList = [];
  const jobMap = new Map();

  for (const run of filtered) {
    const jobs = Array.isArray(run.jobs) ? run.jobs : [];
    const startCandidates = [run.created_at, ...jobs.map((j) => j.created_at)]
      .filter(Boolean)
      .map((ts) => Date.parse(ts))
      .filter(Number.isFinite);
    const endCandidates = [run.updated_at, ...jobs.map((j) => j.completed_at)]
      .filter(Boolean)
      .map((ts) => Date.parse(ts))
      .filter(Number.isFinite);

    if (startCandidates.length > 0 && endCandidates.length > 0) {
      const flowStart = Math.min(...startCandidates);
      const flowEnd = Math.max(...endCandidates);
      workflowDurations.push(Math.max(0, (flowEnd - flowStart) / 1000));
    }

    let runExact = 0;
    let runBilled = 0;

    for (const job of jobs) {
      if (job.conclusion === 'skipped' && !job.started_at) continue;
      const queue = secondsBetween(job.created_at, job.started_at);
      const duration = secondsBetween(job.started_at, job.completed_at);
      const { exactMinutes, billedMinutes } = jobMinutes(duration);
      runExact += exactMinutes;
      runBilled += billedMinutes;

      let jobAcc = jobMap.get(job.name);
      if (!jobAcc) {
        jobAcc = { name: job.name, queues: [], durations: [], steps: new Map() };
        jobMap.set(job.name, jobAcc);
      }
      jobAcc.queues.push(queue);
      jobAcc.durations.push(duration);

      const steps = Array.isArray(job.steps) ? job.steps : [];
      for (const step of steps) {
        const stepQueue = secondsBetween(step.created_at, step.started_at);
        const stepDuration = secondsBetween(step.started_at, step.completed_at);
        let stepAcc = jobAcc.steps.get(step.name);
        if (!stepAcc) {
          stepAcc = { name: step.name, queues: [], durations: [] };
          jobAcc.steps.set(step.name, stepAcc);
        }
        stepAcc.queues.push(stepQueue);
        stepAcc.durations.push(stepDuration);
      }
    }

    exactMachineList.push(runExact);
    billedMachineList.push(runBilled);
  }

  const jobs = [...jobMap.values()].map((jobAcc) => ({
    name: jobAcc.name,
    count: jobAcc.durations.length,
    queueSeconds: computeStats(jobAcc.queues),
    durationSeconds: computeStats(jobAcc.durations),
    steps: [...jobAcc.steps.values()].map((stepAcc) => ({
      name: stepAcc.name,
      count: stepAcc.durations.length,
      queueSeconds: computeStats(stepAcc.queues),
      durationSeconds: computeStats(stepAcc.durations),
    })),
  }));

  return {
    baseBranch,
    runCount: filtered.length,
    workflow: {
      durationSeconds: computeStats(workflowDurations),
      exactMachineMinutes: computeStats(exactMachineList, round2),
      billedMachineMinutes: computeStats(billedMachineList, round1),
    },
    jobs,
  };
}

/**
 * Formatea el resumen en texto legible y lo compara con la línea base si está disponible.
 * @param {ReturnType<typeof aggregateRuns>} summary
 * @param {object | null} [baseline]
 * @returns {string}
 */
export function formatReport(summary, baseline = null) {
  const lines = [];
  lines.push(`# Tiempos del CI (base: ${summary.baseBranch}, ejecuciones: ${summary.runCount})`);
  lines.push('');

  if (summary.runCount === 0) {
    lines.push('No se encontraron ejecuciones completadas para esa rama base.');
    return lines.join('\n');
  }

  const wf = summary.workflow;
  lines.push(
    `- Flujo total: prom ${wf.durationSeconds.avg} s (mín ${wf.durationSeconds.min} s, máx ${wf.durationSeconds.max} s)`,
  );
  lines.push(
    `- Minutos de máquina exactos: prom ${wf.exactMachineMinutes.avg} min (mín ${wf.exactMachineMinutes.min}, máx ${wf.exactMachineMinutes.max})`,
  );
  lines.push(
    `- Minutos de máquina facturados (por job redondeado): prom ${wf.billedMachineMinutes.avg} min (mín ${wf.billedMachineMinutes.min}, máx ${wf.billedMachineMinutes.max})`,
  );

  if (baseline?.ci) {
    const baseSec = baseline.ci.totalSeconds;
    const baseMin = baseline.ci.billedMachineMinutes;
    const deltaSec = round1(wf.durationSeconds.avg - baseSec);
    const deltaMin = round1(wf.billedMachineMinutes.avg - baseMin);
    lines.push(
      `- Línea base (${baseline.date}): flujo ${baseSec} s (delta ${deltaSec >= 0 ? '+' : ''}${deltaSec} s), máquina ${baseMin} min (delta ${deltaMin >= 0 ? '+' : ''}${deltaMin} min)`,
    );
  }

  lines.push('');
  lines.push('## Jobs');
  for (const job of summary.jobs) {
    lines.push(
      `- ${job.name} (n=${job.count}): cola prom ${job.queueSeconds.avg} s | duración prom ${job.durationSeconds.avg} s (mín ${job.durationSeconds.min} s, máx ${job.durationSeconds.max} s)`,
    );
    for (const step of job.steps) {
      lines.push(
        `  - ${step.name}: cola ${step.queueSeconds.avg} s | prom ${step.durationSeconds.avg} s (mín ${step.durationSeconds.min} s, máx ${step.durationSeconds.max} s)`,
      );
    }
  }

  return lines.join('\n');
}

function wrapGhError(err, args) {
  if (err && (err.code === 'ENOENT' || /ENOENT/i.test(String(err.message)))) {
    return new Error(
      'GitHub CLI (gh) no está instalado o no está en PATH. Instálalo y autentícate con `gh auth login`.',
    );
  }
  if (err instanceof Error && err.message.startsWith('GitHub CLI (gh)')) {
    return err;
  }
  return new Error(`Error al ejecutar gh ${args.join(' ')}: ${err?.message ?? err}`);
}

async function defaultExecGh(args) {
  return execFile('gh', args, { maxBuffer: 20 * 1024 * 1024 });
}

async function runGh(execGh, args) {
  try {
    return await execGh(args);
  } catch (err) {
    throw wrapGhError(err, args);
  }
}

/**
 * Consulta en GitHub las últimas N ejecuciones del workflow hacia la rama base indicada.
 * @param {{ runs: number, workflow: string, baseBranch: string, execGh?: (args: string[]) => Promise<{ stdout: string }> }} options
 */
export async function fetchWorkflowRuns({
  runs,
  workflow,
  baseBranch,
  execGh = defaultExecGh,
}) {
  const listRes = await runGh(execGh, [
    'api',
    `/repos/{owner}/{repo}/actions/workflows/${workflow}/runs?event=pull_request&status=completed&per_page=100`,
  ]);
  const listData = JSON.parse(listRes.stdout);
  const matching = (listData.workflow_runs ?? [])
    .filter((run) => extractBaseBranch(run) === baseBranch)
    .slice(0, runs);

  const detailed = [];
  for (const run of matching) {
    const jobsRes = await runGh(execGh, [
      'api',
      '--paginate',
      `/repos/{owner}/{repo}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`,
    ]);
    const jobsData = JSON.parse(jobsRes.stdout);
    detailed.push({
      ...run,
      jobs: jobsData.jobs ?? [],
    });
  }

  return detailed;
}

function loadBaseline(filePath = DEFAULT_BASELINE_PATH) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runs = await fetchWorkflowRuns(args);
  const summary = aggregateRuns(runs, { baseBranch: args.baseBranch });
  const baseline = loadBaseline();

  if (args.json) {
    console.log(JSON.stringify({ summary, baseline }, null, 2));
  } else {
    console.log(formatReport(summary, baseline));
  }
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
