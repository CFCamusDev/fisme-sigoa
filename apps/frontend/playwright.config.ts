import { defineConfig, devices } from '@playwright/test';

const BACKEND_PORT = 3100;
const FRONTEND_PORT = 4173;
const TEST_DB_URL =
  process.env['TEST_DATABASE_URL'] ||
  process.env['DATABASE_URL'] ||
  'postgresql://postgres:postgres@localhost:5432/sigoa_test?schema=public';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter backend exec tsx src/server.ts',
      url: `http://localhost:${BACKEND_PORT}/health`,
      reuseExistingServer: !process.env['CI'],
      timeout: 30000,
      env: {
        NODE_ENV: 'test',
        PORT: String(BACKEND_PORT),
        CORS_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
        DATABASE_URL: TEST_DB_URL,
        HSTS_ENABLED: 'false',
        LOG_LEVEL: 'silent',
      },
    },
    {
      command: `pnpm --filter frontend build && pnpm --filter frontend exec vite preview --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env['CI'],
      timeout: 30000,
      env: {
        VITE_API_URL: `http://localhost:${BACKEND_PORT}`,
      },
    },
  ],
});
