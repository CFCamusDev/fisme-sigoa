import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertTestDatabase } from './assert-test-database.js';
import { hashMigrations } from './prepare-test-database.js';
import {
  databaseNameOf,
  resolveWorkerCount,
  resolveWorkerDatabaseUrl,
  templateDatabaseName,
  withDatabaseName,
  workerDatabaseName,
} from './worker-databases.js';

const baseUrl = 'postgresql://postgres:postgres@localhost:5432/sigoa_test?schema=public';

describe('resolveWorkerCount (T-078-07, D6)', () => {
  it('uses TEST_DB_WORKERS when it is a valid integer', () => {
    expect(resolveWorkerCount({ TEST_DB_WORKERS: '3' }, 16)).toBe(3);
    expect(resolveWorkerCount({ TEST_DB_WORKERS: '1' }, 16)).toBe(1);
  });

  it.each(['0', '-1', 'abc', '1.5', '33'])('rejects TEST_DB_WORKERS=%s', (value) => {
    expect(() => resolveWorkerCount({ TEST_DB_WORKERS: value }, 16)).toThrow(/TEST_DB_WORKERS/);
  });

  it('defaults to the smaller of 4 and half the cores, at least 1', () => {
    expect(resolveWorkerCount({}, 1)).toBe(1);
    expect(resolveWorkerCount({}, 2)).toBe(1);
    expect(resolveWorkerCount({}, 6)).toBe(3);
    expect(resolveWorkerCount({}, 12)).toBe(4);
    expect(resolveWorkerCount({}, 64)).toBe(4);
  });

  it('keeps a single worker in the CI unless TEST_DB_WORKERS says otherwise', () => {
    expect(resolveWorkerCount({ CI: 'true' }, 16)).toBe(1);
    expect(resolveWorkerCount({ CI: 'true', TEST_DB_WORKERS: '2' }, 16)).toBe(2);
  });
});

describe('worker database names (T-078-07, D4)', () => {
  it.each(['sigoa_test', 'oeag_test', 'sigoa_verify_ab12_test', 'plain'])(
    'derives names that end in _test from %s',
    (name) => {
      const names = [templateDatabaseName(name), workerDatabaseName(name, 1)];
      for (const derived of names) {
        expect(derived).toMatch(/^[a-z0-9_]+_test$/);
        expect(() => assertTestDatabase(withDatabaseName(baseUrl, derived))).not.toThrow();
      }
    },
  );

  it('builds template and worker names from the base name', () => {
    expect(templateDatabaseName('sigoa_test')).toBe('sigoa_tpl_test');
    expect(workerDatabaseName('sigoa_test', 2)).toBe('sigoa_w2_test');
  });

  it('never maps a worker onto the base database or the template', () => {
    const names = new Set([
      'sigoa_test',
      templateDatabaseName('sigoa_test'),
      ...[1, 2, 3, 4].map((index) => workerDatabaseName('sigoa_test', index)),
    ]);
    expect(names.size).toBe(6);
  });

  it('replaces only the database in the connection URL', () => {
    const url = withDatabaseName(baseUrl, 'sigoa_w1_test');
    expect(databaseNameOf(url)).toBe('sigoa_w1_test');
    expect(new URL(url).username).toBe('postgres');
    expect(new URL(url).searchParams.get('schema')).toBe('public');
  });
});

describe('resolveWorkerDatabaseUrl (T-078-08)', () => {
  it('returns the worker database from VITEST_POOL_ID when there are several workers', () => {
    const env = { TEST_DB_WORKERS: '4', VITEST_POOL_ID: '3' };
    expect(databaseNameOf(resolveWorkerDatabaseUrl(baseUrl, env))).toBe('sigoa_w3_test');
  });

  it('keeps the base database with one worker, without pool id, or with an out-of-range id', () => {
    expect(resolveWorkerDatabaseUrl(baseUrl, { TEST_DB_WORKERS: '1', VITEST_POOL_ID: '1' })).toBe(
      baseUrl,
    );
    expect(resolveWorkerDatabaseUrl(baseUrl, { TEST_DB_WORKERS: '4' })).toBe(baseUrl);
    expect(resolveWorkerDatabaseUrl(baseUrl, { TEST_DB_WORKERS: '2', VITEST_POOL_ID: '3' })).toBe(
      baseUrl,
    );
    expect(resolveWorkerDatabaseUrl(baseUrl, { TEST_DB_WORKERS: '2', VITEST_POOL_ID: 'x' })).toBe(
      baseUrl,
    );
  });
});

describe('hashMigrations (T-078-07, D5)', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigoa-migrations-'));
    fs.mkdirSync(path.join(dir, '001_init'));
    fs.writeFileSync(path.join(dir, '001_init', 'migration.sql'), 'CREATE TABLE a ();');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('is stable for the same content', () => {
    expect(hashMigrations(dir)).toBe(hashMigrations(dir));
    expect(hashMigrations(dir)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when a migration changes or a new one is added', () => {
    const before = hashMigrations(dir);
    fs.writeFileSync(path.join(dir, '001_init', 'migration.sql'), 'CREATE TABLE b ();');
    const edited = hashMigrations(dir);
    expect(edited).not.toBe(before);

    fs.mkdirSync(path.join(dir, '002_next'));
    fs.writeFileSync(path.join(dir, '002_next', 'migration.sql'), 'SELECT 1;');
    expect(hashMigrations(dir)).not.toBe(edited);
  });

  it('hashes the real migrations directory', () => {
    expect(hashMigrations()).toMatch(/^[0-9a-f]{64}$/);
  });
});
