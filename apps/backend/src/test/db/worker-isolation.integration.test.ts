import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertTestDatabase, getTestDatabaseUrl } from './assert-test-database.js';
import { dropWorkerDatabases, prepareWorkerDatabases } from './prepare-test-database.js';
import {
  databaseNameOf,
  templateDatabaseName,
  withDatabaseName,
  workerDatabaseName,
} from './worker-databases.js';

const execFileAsync = promisify(execFile);
const backendRoot = fileURLToPath(new URL('../../../', import.meta.url));

/** Base propia de este archivo: no toca las bases de los workers que corren en paralelo. */
const sandboxBaseName = `iso${crypto.randomBytes(4).toString('hex')}_test`;
const sandboxWorkers = 3;

function adminClientFor(url: string): pg.Client {
  return new pg.Client({
    connectionString: withDatabaseName(url, 'postgres'),
    connectionTimeoutMillis: 10_000,
  });
}

async function dropDatabases(adminUrl: string, names: string[]): Promise<void> {
  const client = adminClientFor(adminUrl);
  await client.connect();
  try {
    for (const name of names) {
      assertTestDatabase(withDatabaseName(adminUrl, name));
      await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    }
  } finally {
    await client.end();
  }
}

/** Código válido para el formato de permisos: `isolation.worker_a`, `isolation.worker_b`... */
function codeFor(index: number): string {
  return `isolation.worker_${String.fromCharCode(97 + index)}`;
}

describe('worker database isolation (T-078-09, CA3)', () => {
  const sandboxUrl = withDatabaseName(getTestDatabaseUrl(), sandboxBaseName);
  let workerUrls: string[] = [];

  beforeAll(async () => {
    workerUrls = await prepareWorkerDatabases(sandboxWorkers, sandboxUrl);
  }, 120_000);

  afterAll(async () => {
    await dropWorkerDatabases(sandboxWorkers, sandboxUrl);
    await dropDatabases(sandboxUrl, [templateDatabaseName(sandboxBaseName), sandboxBaseName]);
  }, 180_000);

  it('names every worker database with the _test suffix', () => {
    expect(workerUrls).toHaveLength(sandboxWorkers);
    for (const url of workerUrls) {
      expect(databaseNameOf(url)).toMatch(/^[a-z0-9_]+_test$/);
      expect(() => assertTestDatabase(url)).not.toThrow();
    }
    expect(new Set(workerUrls.map(databaseNameOf)).size).toBe(sandboxWorkers);
  });

  it('runs the worker of this very file on a database ending in _test', async () => {
    const client = new pg.Client({ connectionString: getTestDatabaseUrl() });
    await client.connect();
    try {
      const result = await client.query<{ name: string }>('SELECT current_database() AS name');
      expect(result.rows[0]?.name).toMatch(/_test$/);
    } finally {
      await client.end();
    }
  });

  it('keeps each worker data isolated', async () => {
    const clients = workerUrls.map((url) => new pg.Client({ connectionString: url }));
    await Promise.all(clients.map((client) => client.connect()));
    try {
      // Cada base se ensucia en paralelo con una fila propia.
      await Promise.all(
        clients.map((client, index) =>
          client.query(
            `INSERT INTO permissions (id, code, description, module, "createdBy", "updatedBy", "createdAt", "updatedAt")
             VALUES ($1, $2, 'aislamiento', 'testing', 'TEST', 'TEST', now(), now())`,
            [crypto.randomUUID(), codeFor(index)],
          ),
        ),
      );

      for (const [index, client] of clients.entries()) {
        const result = await client.query<{ code: string }>(
          `SELECT code FROM permissions WHERE code LIKE 'isolation.%'`,
        );
        expect(result.rows.map((row) => row.code)).toEqual([codeFor(index)]);
      }

      const template = new pg.Client({
        connectionString: withDatabaseName(sandboxUrl, templateDatabaseName(sandboxBaseName)),
      });
      await template.connect();
      try {
        const result = await template.query(
          `SELECT 1 FROM permissions WHERE code LIKE 'isolation.%'`,
        );
        expect(result.rowCount).toBe(0);
      } finally {
        await template.end();
      }
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it('derives worker names that never collide with the template', () => {
    const names = [
      templateDatabaseName(sandboxBaseName),
      ...workerUrls.map((url) => databaseNameOf(url)),
    ];
    expect(new Set(names).size).toBe(sandboxWorkers + 1);
    expect(workerDatabaseName(sandboxBaseName, 1)).toBe(databaseNameOf(workerUrls[0]!));
  });
});

describe('integration results with one and four workers (T-078-09, CA2)', () => {
  const compareBaseName = `cmp${crypto.randomBytes(4).toString('hex')}_test`;
  const compareUrl = withDatabaseName(getTestDatabaseUrl(), compareBaseName);
  const subset = [
    'src/modules/authorization/infrastructure/prisma/prisma-role-reader.integration.test.ts',
    'src/modules/authorization/infrastructure/prisma/create-role.integration.test.ts',
    'src/modules/authorization/infrastructure/prisma/edit-role.integration.test.ts',
    'src/modules/authorization/infrastructure/prisma/prisma-grant-reader.integration.test.ts',
    'src/modules/parameters/infrastructure/http/program.routes.integration.test.ts',
    'src/modules/parameters/infrastructure/http/semesters.routes.integration.test.ts',
  ];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigoa-workers-'));

  afterAll(async () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await dropDatabases(compareUrl, [
      ...[1, 2, 3, 4].map((index) => workerDatabaseName(compareBaseName, index)),
      templateDatabaseName(compareBaseName),
      compareBaseName,
    ]);
  }, 180_000);

  async function runSubset(workers: number): Promise<Map<string, string>> {
    const outputFile = path.join(tmpDir, `result-${workers}.json`);
    const vitestBin = path.join(
      path.dirname(createRequire(import.meta.url).resolve('vitest/package.json')),
      'vitest.mjs',
    );
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith('VITEST')) delete env[key];
    }
    env['TEST_DATABASE_URL'] = compareUrl;
    env['TEST_DB_WORKERS'] = String(workers);

    await execFileAsync(
      process.execPath,
      [
        vitestBin,
        'run',
        '--project',
        'integration',
        '--reporter=json',
        `--outputFile=${outputFile}`,
        ...subset,
      ],
      { cwd: backendRoot, env, timeout: 170_000, maxBuffer: 64 * 1024 * 1024 },
    );

    const report = JSON.parse(fs.readFileSync(outputFile, 'utf8')) as {
      testResults: Array<{
        name: string;
        assertionResults: Array<{ fullName: string; status: string }>;
      }>;
    };
    const results = new Map<string, string>();
    for (const file of report.testResults) {
      const fileName = path.basename(file.name);
      for (const assertion of file.assertionResults) {
        results.set(`${fileName} > ${assertion.fullName}`, assertion.status);
      }
    }
    return results;
  }

  it('produces the same results with one and four workers', async () => {
    const single = await runSubset(1);
    const parallel = await runSubset(4);

    expect(single.size).toBeGreaterThan(10);
    expect([...single.values()].every((status) => status === 'passed')).toBe(true);
    expect([...parallel.entries()].sort()).toEqual([...single.entries()].sort());
  }, 240_000);
});
