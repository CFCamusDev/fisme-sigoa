import fs from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { closeWorkerSeeder, initWorkerSeeder } from './seeder';
import { startWorkerStack, type WorkerStack } from './worker-stack';

interface DatabasesFile {
  workers: number;
  urls: string[];
}

/** Variables de proceso que el fixture fija para el worker (las leen seed-user y las specs). */
const WORKER_ENV_KEYS = [
  'TEST_DATABASE_URL',
  'DATABASE_URL',
  'E2E_API_URL',
  'E2E_WEB_URL',
] as const;

function readDatabases(): DatabasesFile {
  const file = process.env['E2E_DATABASES_FILE'];
  if (!file) {
    throw new Error('Falta E2E_DATABASES_FILE: el globalSetup de E2E no preparó las bases.');
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as DatabasesFile;
}

/**
 * `test` de Playwright con una pila propia por worker (HU-078, D9): su base de datos clonada, su
 * backend y su frontend en puertos libres. Las especificaciones importan este `test`, no el de
 * `@playwright/test`.
 */
export const test = base.extend<object, { workerStack: WorkerStack }>({
  workerStack: [
    async ({ browserName }, provide, workerInfo) => {
      if (!browserName) throw new Error('Falta el navegador del worker.');
      const { urls } = readDatabases();
      const databaseUrl = urls[workerInfo.parallelIndex];
      if (!databaseUrl) {
        throw new Error(
          `No hay base de datos para el worker ${workerInfo.parallelIndex} (hay ${urls.length}).`,
        );
      }

      const stack = await startWorkerStack({
        index: workerInfo.parallelIndex,
        databaseUrl,
        runId: process.env['E2E_RUN_ID'] ?? String(process.pid),
      });

      await initWorkerSeeder(databaseUrl);

      const previous = new Map(WORKER_ENV_KEYS.map((key) => [key, process.env[key]]));
      process.env['TEST_DATABASE_URL'] = databaseUrl;
      process.env['DATABASE_URL'] = databaseUrl;
      process.env['E2E_API_URL'] = stack.apiUrl;
      process.env['E2E_WEB_URL'] = stack.webUrl;
      try {
        await provide(stack);
      } finally {
        for (const [key, value] of previous) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
        await closeWorkerSeeder();
        await stack.stop();
      }
    },
    { scope: 'worker', auto: true, timeout: 180_000 },
  ],

  baseURL: async ({ workerStack }, provide) => {
    await provide(workerStack.webUrl);
  },
});

export { expect };
