import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveE2EWorkers } from './support/workers';

/**
 * Prepara una base de datos por worker (clonada de una plantilla migrada) y publica sus URL en un
 * archivo temporal que leen los workers (HU-078, D13). Devuelve el cierre que las elimina.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const workers = resolveE2EWorkers();
  const runId = `${process.pid}-${Date.now().toString(36)}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigoa-e2e-db-'));
  const databasesFile = path.join(dir, 'databases.json');

  execSync(`pnpm --filter backend db:test:prepare --workers ${workers} --out "${databasesFile}"`, {
    stdio: 'inherit',
    env: { ...process.env },
  });

  process.env['E2E_DATABASES_FILE'] = databasesFile;
  process.env['E2E_RUN_ID'] = runId;

  return async () => {
    try {
      execSync(`pnpm --filter backend db:test:prepare --drop-workers ${workers}`, {
        stdio: 'ignore',
        env: { ...process.env },
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      // Marcadores de la prueba de aislamiento de workers (e2e/worker-isolation.spec.ts).
      fs.rmSync(path.join(os.tmpdir(), `sigoa-e2e-isolation-${runId}`), {
        recursive: true,
        force: true,
      });
    }
  };
}
