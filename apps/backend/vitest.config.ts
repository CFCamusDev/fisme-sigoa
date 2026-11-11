import { defineConfig } from 'vitest/config';
import { resolveWorkerCount } from './src/test/db/worker-databases.ts';

// Una base de datos por worker (HU-078): con 1 worker los archivos corren en serie como siempre.
const integrationWorkers = resolveWorkerCount();

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/modules/*/domain/**/*.ts', 'src/modules/*/application/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.integration.test.ts',
        'src/**/index.ts',
        'src/**/*.d.ts',
        'src/modules/*/domain/ports/**',
        'src/shared/prisma/generated/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['src/**/*.test.ts', 'openapi/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          include: ['src/**/*.integration.test.ts'],
          fileParallelism: integrationWorkers > 1,
          maxWorkers: integrationWorkers,
          globalSetup: ['src/test/db/global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
