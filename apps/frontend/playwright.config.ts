import { defineConfig, devices } from '@playwright/test';
import { resolveE2EWorkers } from './e2e/support/workers';

const TEST_DB_URL =
  process.env['TEST_DATABASE_URL'] ||
  process.env['DATABASE_URL'] ||
  'postgresql://postgres:postgres@localhost:5432/sigoa_test?schema=public';

function assertTestDatabaseUrl(url: string): void {
  try {
    const parsed = new URL(url);
    const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];
    if (!dbName || !dbName.endsWith('_test')) {
      throw new Error(
        `Las pruebas E2E solo pueden ejecutarse contra una base de datos cuyo nombre termine en '_test' (recibido: '${dbName}'). Esto previene la alteración accidental de bases de datos de desarrollo o producción.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('_test')) {
      throw error;
    }
    throw new Error(`URL de base de datos de pruebas no válida para E2E: '${url}'`, {
      cause: error,
    });
  }
}

assertTestDatabaseUrl(TEST_DB_URL);

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  // Cada worker tiene su base de datos, su backend y su frontend (e2e/support/test.ts).
  workers: resolveE2EWorkers(),
  timeout: 30_000,
  globalTimeout: 15 * 60 * 1000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
