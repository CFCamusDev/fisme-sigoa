import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error script sin archivo de declaraciones .d.ts
import {
  extractBackendVariableNames,
  extractComposeEnvironmentKeys,
} from '../../../../scripts/ci/check-env-parity.mjs';

const ROOT_DIR = path.resolve(__dirname, '../../../../');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

describe('compose db reset environment contract (T-081-38)', () => {
  it('declares the reset variables off in the three examples', () => {
    const examplePaths = ['.env.example', 'apps/backend/.env.example', 'deploy/stack.env.example'];

    for (const filePath of examplePaths) {
      const content = readRepoFile(filePath);
      expect(content, filePath).toMatch(/^DB_RESET_ON_DEPLOY=false\s*$/m);
      expect(content, filePath).toMatch(/^DB_RESET_CONFIRM=\s*$/m);
    }
  });

  it('passes them only to migrate', () => {
    const composeProd = readRepoFile('docker-compose.prod.yml');
    const migrateKeys = extractComposeEnvironmentKeys(composeProd, 'migrate');

    expect(migrateKeys.has('DB_RESET_ON_DEPLOY')).toBe(true);
    expect(migrateKeys.has('DB_RESET_CONFIRM')).toBe(true);
    expect(migrateKeys.has('APP_PUBLIC_URL')).toBe(true);
  });

  it('never reaches the backend or envSchema', () => {
    const composeDev = readRepoFile('docker-compose.yml');
    const composeProd = readRepoFile('docker-compose.prod.yml');
    const envTs = readRepoFile('apps/backend/src/config/env.ts');

    const devBackendKeys = extractComposeEnvironmentKeys(composeDev, 'backend');
    const prodBackendKeys = extractComposeEnvironmentKeys(composeProd, 'backend');
    const schemaVars = extractBackendVariableNames(envTs);

    for (const key of ['DB_RESET_ON_DEPLOY', 'DB_RESET_CONFIRM']) {
      expect(devBackendKeys.has(key)).toBe(false);
      expect(prodBackendKeys.has(key)).toBe(false);
      expect(schemaVars.includes(key)).toBe(false);
    }
  });

  it('runs db:reset between provision-app-role and seed', () => {
    const dockerfile = readRepoFile('apps/backend/Dockerfile');
    const cmdLine = dockerfile.split('\n').find((line) => line.trim().startsWith('CMD '));

    expect(cmdLine).toBeDefined();
    const cmd = cmdLine ?? '';

    const provision = cmd.indexOf('db:provision-app-role');
    const reset = cmd.indexOf('db:reset');
    const seed = cmd.indexOf('db:seed');

    expect(provision).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(provision);
    expect(seed).toBeGreaterThan(reset);
    expect(cmd.slice(provision, seed)).not.toContain(';');
  });
});
