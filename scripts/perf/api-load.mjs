// Medición de desempeño de la API (RNF-018): p95 < 500 ms en consultas y < 1 s en escrituras
// con 20 usuarios internos concurrentes. Sin dependencias: usa fetch de Node.
//
// Uso:
//   SIGOA_PERF_EMAIL=... SIGOA_PERF_PASSWORD=... node scripts/perf/api-load.mjs --base-url http://localhost:3000
// Opciones: --users 20 · --duration 30 (segundos) · --think-ms 100 · --writes · --out-dir tmp/perf
//
// El limitador general (RATE_LIMIT_GENERAL_MAX, 300 por minuto y por IP) cuenta las peticiones de
// todos los usuarios virtuales. Para medir el servidor y no el limitador, levanta el backend de
// prueba con un valor mayor. Las respuestas 429 se informan aparte y hacen fallar la medición.
// Con --writes se hace un PATCH /program con el mismo nombre actual: no cambia datos, pero deja un
// registro de auditoría por petición; úsalo solo en un entorno de prueba.
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const READ_P95_LIMIT_MS = 500;
export const WRITE_P95_LIMIT_MS = 1000;
export const READ_ENDPOINTS = [
  '/me/permissions',
  '/users',
  '/roles',
  '/semesters',
  '/parameters',
  '/response-scales',
  '/program',
];

/** Percentil por rango más cercano sobre una lista de números. */
export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/** Resume muestras { ms, status } de un grupo de operaciones. */
export function summarize(samples) {
  const latencies = samples.map((s) => s.ms);
  const rateLimited = samples.filter((s) => s.status === 429).length;
  const failed = samples.filter(
    (s) => s.status === 0 || (s.status >= 400 && s.status !== 429),
  ).length;
  return {
    count: samples.length,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies.length ? Math.max(...latencies) : null,
    failed,
    rateLimited,
  };
}

/** Evalúa los resúmenes contra los límites de RNF-018. */
export function evaluate(reads, writes) {
  const problems = [];
  if (reads.count === 0) problems.push('No hubo consultas.');
  if (reads.p95 !== null && reads.p95 >= READ_P95_LIMIT_MS) {
    problems.push(`p95 de consultas ${reads.p95} ms >= ${READ_P95_LIMIT_MS} ms.`);
  }
  if (writes && writes.p95 !== null && writes.p95 >= WRITE_P95_LIMIT_MS) {
    problems.push(`p95 de escrituras ${writes.p95} ms >= ${WRITE_P95_LIMIT_MS} ms.`);
  }
  for (const [name, s] of [
    ['consultas', reads],
    ['escrituras', writes],
  ]) {
    if (!s) continue;
    if (s.failed > 0) problems.push(`${s.failed} ${name} con error.`);
    if (s.rateLimited > 0) problems.push(`${s.rateLimited} ${name} rechazadas con 429.`);
  }
  return { ok: problems.length === 0, problems };
}

export function parseArgs(argv) {
  const opts = {
    baseUrl: 'http://localhost:3000',
    users: 20,
    durationSeconds: 30,
    thinkMs: 100,
    writes: false,
    outDir: 'tmp/perf',
  };
  const positive = (flag, raw) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} debe ser un entero positivo.`);
    return n;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (argv[i] === undefined) throw new Error(`${arg} requiere un valor.`);
      return argv[i];
    };
    if (arg === '--base-url') opts.baseUrl = next().replace(/\/+$/, '');
    else if (arg === '--users') opts.users = positive(arg, next());
    else if (arg === '--duration') opts.durationSeconds = positive(arg, next());
    else if (arg === '--think-ms') {
      const n = Number(next());
      if (!Number.isInteger(n) || n < 0) throw new Error('--think-ms debe ser un entero >= 0.');
      opts.thinkMs = n;
    } else if (arg === '--writes') opts.writes = true;
    else if (arg === '--out-dir') opts.outDir = next();
    else throw new Error(`Opción desconocida: ${arg}`);
  }
  return opts;
}

async function timed(url, init) {
  const start = performance.now();
  try {
    const res = await globalThis.fetch(url, init);
    await res.arrayBuffer();
    return { ms: Math.round(performance.now() - start), status: res.status, res };
  } catch {
    return { ms: Math.round(performance.now() - start), status: 0, res: null };
  }
}

async function login(baseUrl, email, password) {
  const res = await globalThis.fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`El inicio de sesión respondió ${res.status}.`);
  const body = await res.json();
  const token = body?.accessToken ?? body?.data?.accessToken;
  if (!token) throw new Error('La respuesta de inicio de sesión no trae accessToken.');
  return token;
}

async function currentProgramName(baseUrl, headers) {
  const res = await globalThis.fetch(`${baseUrl}/program`, { headers });
  if (!res.ok) throw new Error(`GET /program respondió ${res.status}.`);
  const body = await res.json();
  const name = body?.name ?? body?.data?.name ?? body?.program?.name;
  if (typeof name !== 'string') throw new Error('GET /program no devolvió el nombre del programa.');
  return name;
}

export async function run(opts, credentials) {
  const token = await login(opts.baseUrl, credentials.email, credentials.password);
  const headers = { authorization: `Bearer ${token}` };
  const writeBody = opts.writes
    ? JSON.stringify({ name: await currentProgramName(opts.baseUrl, headers) })
    : null;

  const reads = [];
  const writes = [];
  const deadline = Date.now() + opts.durationSeconds * 1000;

  async function virtualUser(index) {
    let step = index;
    while (Date.now() < deadline) {
      const isWrite = writeBody !== null && step % 10 === 9;
      if (isWrite) {
        const { ms, status } = await timed(`${opts.baseUrl}/program`, {
          method: 'PATCH',
          headers: { ...headers, 'content-type': 'application/json' },
          body: writeBody,
        });
        writes.push({ ms, status });
      } else {
        const endpoint = READ_ENDPOINTS[step % READ_ENDPOINTS.length];
        const { ms, status } = await timed(`${opts.baseUrl}${endpoint}`, { headers });
        reads.push({ ms, status });
      }
      step += 1;
      if (opts.thinkMs > 0) await sleep(opts.thinkMs);
    }
  }

  await Promise.all(Array.from({ length: opts.users }, (_, i) => virtualUser(i)));

  const readSummary = summarize(reads);
  const writeSummary = writeBody !== null ? summarize(writes) : null;
  return { reads: readSummary, writes: writeSummary, ...evaluate(readSummary, writeSummary) };
}

export function renderReport(opts, result) {
  const row = (name, s, limit) =>
    s
      ? `| ${name} | ${s.count} | ${s.p50} | ${s.p95} | ${s.p99} | ${s.max} | ${s.failed} | ${s.rateLimited} | < ${limit} |`
      : `| ${name} | no medido | | | | | | | < ${limit} |`;
  return [
    '# Desempeño de la API (RNF-018)',
    '',
    `Generado: ${new Date().toISOString()} · Usuarios concurrentes: ${opts.users} · Duración: ${opts.durationSeconds} s · Pausa: ${opts.thinkMs} ms`,
    '',
    '| Operación | Peticiones | p50 (ms) | p95 (ms) | p99 (ms) | Máx (ms) | Con error | 429 | Límite p95 (ms) |',
    '|---|---|---|---|---|---|---|---|---|',
    row('Consultas', result.reads, READ_P95_LIMIT_MS),
    row('Escrituras', result.writes, WRITE_P95_LIMIT_MS),
    '',
    result.ok ? 'Resultado: dentro de RNF-018.' : `Resultado: FUERA. ${result.problems.join(' ')}`,
    '',
  ].join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const email = process.env.SIGOA_PERF_EMAIL;
  const password = process.env.SIGOA_PERF_PASSWORD;
  if (!email || !password) {
    throw new Error('Define SIGOA_PERF_EMAIL y SIGOA_PERF_PASSWORD en el entorno.');
  }
  const result = await run(opts, { email, password });
  fs.mkdirSync(opts.outDir, { recursive: true });
  fs.writeFileSync(path.join(opts.outDir, 'api-report.json'), JSON.stringify(result, null, 2));
  const report = renderReport(opts, result);
  fs.writeFileSync(path.join(opts.outDir, 'api-report.md'), report);
  console.log(report);
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
