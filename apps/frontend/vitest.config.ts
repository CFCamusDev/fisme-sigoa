import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import vitestProjects from './vitest-projects.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allTestInclude = ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.mjs'];
const nodeExceptionFiles = vitestProjects.nodeExceptions.map((entry) => entry.file);

function resolveNodeTestFiles(): string[] {
  const exceptionSet = new Set(nodeExceptionFiles);
  const matched = vitestProjects.nodeInclude.flatMap((pattern) =>
    fs.globSync(pattern, { cwd: __dirname }).map((file) => file.replaceAll('\\', '/')),
  );
  return [...new Set(matched)].filter((file) => !exceptionSet.has(file)).sort();
}

const nodeTestFiles = resolveNodeTestFiles();

export default defineConfig({
  test: {
    globals: true,
    env: {
      VITE_API_URL: 'http://localhost:3000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          setupFiles: ['src/test/setup-node.ts'],
          include: nodeTestFiles,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['src/test/setup.ts'],
          include: allTestInclude,
          exclude: nodeTestFiles,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
