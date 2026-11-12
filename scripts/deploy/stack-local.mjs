#!/usr/bin/env node
// ==============================================================================
// Stack de staging en la máquina del desarrollador (HU-079, RNF-039)
// Levanta el mismo docker-compose.prod.yml con las variables de .env.staging.local
// (ignorado por Git) en el proyecto fijo `sigoa-staging-local`.
//   node scripts/deploy/stack-local.mjs up | down | reset
// ==============================================================================
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PROJECT_NAME = 'sigoa-staging-local';
export const ENV_FILE = '.env.staging.local';
export const COMPOSE_FILE = 'docker-compose.prod.yml';
export const HEALTH_TIMEOUT_MS = 180_000;
export const ACTIONS = ['up', 'down', 'reset'];

/**
 * Argumentos de `docker` para una acción de compose (solo `up` y `down`; `reset` los encadena).
 * @param {'up' | 'down'} action
 * @returns {string[]}
 */
export function buildComposeArgs(action) {
  const base = ['compose', '-p', PROJECT_NAME, '--env-file', ENV_FILE, '-f', COMPOSE_FILE];
  if (action === 'up') {
    return [...base, 'up', '-d', '--build'];
  }
  if (action === 'down') {
    return [...base, 'down', '-v', '--remove-orphans'];
  }
  throw new Error(`Acción de compose desconocida: ${action}`);
}

/**
 * Falla con un mensaje claro si falta el archivo de entorno.
 * @param {string} [envFile]
 * @param {(path: string) => boolean} [exists]
 */
export function assertEnvFile(envFile = ENV_FILE, exists = existsSync) {
  if (!exists(envFile)) {
    throw new Error(
      `No existe ${envFile}. Créalo copiando deploy/stack.env.example (cp deploy/stack.env.example ${envFile}) y ajusta los valores; el archivo no se sube a Git.`,
    );
  }
}

/**
 * Puerto del backend publicado por el compose (SERVER_PORT, 3000 por defecto).
 * @param {string} envContent
 * @returns {number}
 */
export function parseServerPort(envContent) {
  const match = /^SERVER_PORT=(\d+)\s*$/m.exec(envContent);
  return match ? Number(match[1]) : 3000;
}

/**
 * Espera con límite a que GET /health responda 200.
 * @param {string} url
 * @param {{ timeoutMs?: number, fetchFn?: typeof fetch, sleep?: (ms: number) => Promise<void>, now?: () => number }} [options]
 */
export async function waitForHealth(url, options = {}) {
  const {
    timeoutMs = HEALTH_TIMEOUT_MS,
    fetchFn = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
  } = options;
  const deadline = now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetchFn(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        return;
      }
    } catch {
      // El backend aún no escucha: se vuelve a intentar hasta agotar el límite
    }
    if (now() >= deadline) {
      throw new Error(`El backend no respondió en ${url} tras ${Math.round(timeoutMs / 1000)} s.`);
    }
    await sleep(1000);
  }
}

function runDocker(args) {
  const result = spawnSync('docker', args, { stdio: 'inherit' });
  if (result.error) {
    throw new Error(`No se pudo ejecutar docker: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`docker ${args.slice(0, 6).join(' ')} ... terminó con código ${result.status}.`);
  }
}

async function up() {
  runDocker(buildComposeArgs('up'));
  const port = parseServerPort(readFileSync(ENV_FILE, 'utf8'));
  const url = `http://localhost:${port}/health`;
  console.log(`==> Esperando ${url} ...`);
  await waitForHealth(url);
  console.log(`✓ Stack ${PROJECT_NAME} listo. Backend: http://localhost:${port}`);
}

/**
 * @param {string[]} argv
 */
export async function main(argv) {
  const action = argv[0];
  if (!ACTIONS.includes(action)) {
    throw new Error(`Uso: node scripts/deploy/stack-local.mjs ${ACTIONS.join(' | ')}`);
  }
  assertEnvFile();
  if (action === 'down' || action === 'reset') {
    runDocker(buildComposeArgs('down'));
  }
  if (action === 'up' || action === 'reset') {
    await up();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`[stack-local] Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
