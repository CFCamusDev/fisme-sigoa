import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { loadEnvFileIfPresent } from './load-env-file.js';

describe('loadEnvFileIfPresent', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigoa-env-test-'));
    delete process.env['TEST_CUSTOM_SIGOA_VAR'];
    delete process.env['TEST_EXISTING_SIGOA_VAR'];
  });

  afterEach(() => {
    delete process.env['TEST_CUSTOM_SIGOA_VAR'];
    delete process.env['TEST_EXISTING_SIGOA_VAR'];
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('does nothing when the env file does not exist', () => {
    const nonExistentPath = path.join(tempDir, '.env.nonexistent');
    expect(() => loadEnvFileIfPresent(nonExistentPath)).not.toThrow();
  });

  it('loads variables from an existing env file', () => {
    const envPath = path.join(tempDir, '.env');
    fs.writeFileSync(envPath, 'TEST_CUSTOM_SIGOA_VAR=hello_sigoa\n');

    loadEnvFileIfPresent(envPath);

    expect(process.env['TEST_CUSTOM_SIGOA_VAR']).toBe('hello_sigoa');
  });

  it('does not override variables already set in the environment', () => {
    const envPath = path.join(tempDir, '.env');
    fs.writeFileSync(envPath, 'TEST_EXISTING_SIGOA_VAR=from_file\n');

    process.env['TEST_EXISTING_SIGOA_VAR'] = 'already_set';
    loadEnvFileIfPresent(envPath);

    expect(process.env['TEST_EXISTING_SIGOA_VAR']).toBe('already_set');
  });
});
