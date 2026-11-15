import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { E2E_API_PLACEHOLDER } from './support/e2e-web-copy';
import { resolveE2EWorkers } from './support/workers';

/**
 * Prepara una base de datos por worker (clonada de una plantilla migrada) y compila una sola vez
 * el frontend con un marcador de API que cada worker reemplaza en su copia (HU-078, HU-080).
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const workers = resolveE2EWorkers();
  const runId = `${process.pid}-${Date.now().toString(36)}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigoa-e2e-db-'));
  const databasesFile = path.join(dir, 'databases.json');
  const webBaseDir = path.join(os.tmpdir(), `sigoa-e2e-${runId}-web-base`);

  execSync(`pnpm --filter backend db:test:prepare --workers ${workers} --out "${databasesFile}"`, {
    stdio: 'inherit',
    env: { ...process.env },
  });

  execSync(`pnpm --filter frontend exec vite build --outDir "${webBaseDir}" --emptyOutDir`, {
    stdio: 'inherit',
    env: { ...process.env, VITE_API_URL: E2E_API_PLACEHOLDER },
  });

  process.env['E2E_DATABASES_FILE'] = databasesFile;
  process.env['E2E_RUN_ID'] = runId;
  process.env['E2E_WEB_BASE_DIR'] = webBaseDir;

  return async () => {
    try {
      execSync(`pnpm --filter backend db:test:prepare --drop-workers ${workers}`, {
        stdio: 'ignore',
        env: { ...process.env },
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.rmSync(webBaseDir, { recursive: true, force: true });
      // Marcadores de la prueba de aislamiento de workers (e2e/worker-isolation.spec.ts).
      fs.rmSync(path.join(os.tmpdir(), `sigoa-e2e-isolation-${runId}`), {
        recursive: true,
        force: true,
      });
    }
  };
}
