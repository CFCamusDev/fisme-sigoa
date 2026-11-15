import pg from 'pg';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertTestDatabase, getTestDatabaseUrl } from './assert-test-database.js';
import {
  databaseNameOf,
  resolveWorkerCount,
  templateDatabaseName,
  withDatabaseName,
  workerDatabaseName,
} from './worker-databases.js';

const DEFAULT_TEST_URL = 'postgresql://postgres:postgres@localhost:5432/sigoa_test?schema=public';
const MIGRATIONS_HASH_MARKER = 'sigoa-migrations-sha256:';
const MIGRATIONS_DIR = fileURLToPath(new URL('../../../prisma/migrations', import.meta.url));

function resolveBaseTestUrl(): string {
  try {
    return getTestDatabaseUrl();
  } catch {
    process.env['TEST_DATABASE_URL'] = DEFAULT_TEST_URL;
    return DEFAULT_TEST_URL;
  }
}

function adminUrlOf(testUrl: string): string {
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  return adminUrl.toString();
}

function connectionError(testUrl: string, error: unknown): Error {
  return new Error(
    `No se pudo conectar a PostgreSQL para preparar la base de pruebas (${testUrl}). ` +
      `Asegúrate de que el contenedor Docker esté iniciado (docker run --name fisme-postgres ...). Detalle: ${
        error instanceof Error ? error.message : String(error)
      }`,
    { cause: error },
  );
}

function migrateDeploy(databaseUrl: string): void {
  try {
    execSync('pnpm exec prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
      timeout: 120_000,
    });
  } catch (error) {
    throw new Error(
      `Fallo al ejecutar 'prisma migrate deploy' en la base de pruebas: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

/** Nombre de base apto para interpolar como identificador SQL (solo letras minúsculas, dígitos y `_`). */
function quoteDatabaseName(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`Nombre de base de pruebas no permitido: '${name}'.`);
  }
  return `"${name}"`;
}

export async function prepareTestDatabase(): Promise<string> {
  const testUrl = resolveBaseTestUrl();
  const dbName = databaseNameOf(testUrl);

  const client = new pg.Client({
    connectionString: adminUrlOf(testUrl),
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
  } catch (error) {
    throw connectionError(testUrl, error);
  } finally {
    await client.end();
  }

  migrateDeploy(testUrl);

  return testUrl;
}

/**
 * SHA-256 del contenido de `prisma/migrations/**` (rutas relativas y bytes, en orden estable).
 * Sirve para saltar `migrate deploy` cuando la plantilla ya tiene las mismas migraciones.
 */
export function hashMigrations(directory: string = MIGRATIONS_DIR): string {
  const hash = crypto.createHash('sha256');
  const walk = (current: string): void => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        hash.update(path.relative(directory, full).replace(/\\/g, '/'));
        hash.update('\0');
        hash.update(fs.readFileSync(full));
        hash.update('\0');
      }
    }
  };
  walk(directory);
  return hash.digest('hex');
}

async function terminateConnections(client: pg.Client, databaseName: string): Promise<void> {
  await client.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
    [databaseName],
  );
}

async function prepareTemplate(
  client: pg.Client,
  baseUrl: string,
  cloneFromBaseUrl?: string,
): Promise<string> {
  const templateName = templateDatabaseName(databaseNameOf(baseUrl));
  const templateUrl = assertTestDatabase(withDatabaseName(baseUrl, templateName));
  const expected = `${MIGRATIONS_HASH_MARKER}${hashMigrations()}`;

  const current = await client.query<{ comment: string | null }>(
    "SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = $1",
    [templateName],
  );
  if (current.rows[0]?.comment === expected) {
    await terminateConnections(client, templateName);
    return templateName;
  }

  if (cloneFromBaseUrl) {
    const sourceTemplateName = templateDatabaseName(databaseNameOf(cloneFromBaseUrl));
    const sourceComment = await client.query<{ comment: string | null }>(
      "SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = $1",
      [sourceTemplateName],
    );
    if (sourceTemplateName !== templateName && sourceComment.rows[0]?.comment === expected) {
      await terminateConnections(client, sourceTemplateName);
      await terminateConnections(client, templateName);
      await client.query(`DROP DATABASE IF EXISTS ${quoteDatabaseName(templateName)} WITH (FORCE)`);
      await client.query(
        `CREATE DATABASE ${quoteDatabaseName(templateName)} TEMPLATE ${quoteDatabaseName(sourceTemplateName)}`,
      );
      await client.query(
        `COMMENT ON DATABASE ${quoteDatabaseName(templateName)} IS '${expected.replace(/'/g, "''")}'`,
      );
      await terminateConnections(client, templateName);
      return templateName;
    }
  }

  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [templateName]);
  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE ${quoteDatabaseName(templateName)}`);
  }

  migrateDeploy(templateUrl);
  await client.query(
    `COMMENT ON DATABASE ${quoteDatabaseName(templateName)} IS '${expected.replace(/'/g, "''")}'`,
  );

  await terminateConnections(client, templateName);
  return templateName;
}

/**
 * Deja migrada la plantilla `<base>_tpl_test` de una base de pruebas y devuelve su URL (HU-078, D6).
 * El verificador local la llama una sola vez por ejecución y clona de ella las bases de sus grupos.
 */
export async function prepareMigratedTemplate(
  baseUrl: string,
  options?: { cloneFromBaseUrl?: string },
): Promise<string> {
  assertTestDatabase(baseUrl);
  const client = new pg.Client({
    connectionString: adminUrlOf(baseUrl),
    connectionTimeoutMillis: 10_000,
  });
  try {
    try {
      await client.connect();
    } catch (error) {
      throw connectionError(baseUrl, error);
    }
    const templateName = await prepareTemplate(client, baseUrl, options?.cloneFromBaseUrl);
    return withDatabaseName(baseUrl, templateName);
  } finally {
    await client.end();
  }
}

/**
 * Prepara una base por worker clonada de una plantilla migrada (HU-078, D4).
 * Con un solo worker usa la base de siempre. Cada ejecución recrea los clones.
 * Devuelve las URL de las bases que usarán los workers.
 */
export async function prepareWorkerDatabases(
  workerCount: number = resolveWorkerCount(),
  baseUrl?: string,
  options?: { cloneFromBaseUrl?: string },
): Promise<string[]> {
  if (workerCount <= 1 && baseUrl === undefined) {
    return [await prepareTestDatabase()];
  }

  baseUrl = assertTestDatabase(baseUrl ?? resolveBaseTestUrl());
  const baseName = databaseNameOf(baseUrl);
  const client = new pg.Client({
    connectionString: adminUrlOf(baseUrl),
    connectionTimeoutMillis: 10_000,
  });
  const urls: string[] = [];
  try {
    try {
      await client.connect();
    } catch (error) {
      throw connectionError(baseUrl, error);
    }
    const templateName = await prepareTemplate(client, baseUrl, options?.cloneFromBaseUrl);

    for (let index = 1; index <= workerCount; index += 1) {
      const name = workerDatabaseName(baseName, index);
      const url = assertTestDatabase(withDatabaseName(baseUrl, name));
      await terminateConnections(client, name);
      await client.query(`DROP DATABASE IF EXISTS ${quoteDatabaseName(name)} WITH (FORCE)`);
      await client.query(
        `CREATE DATABASE ${quoteDatabaseName(name)} TEMPLATE ${quoteDatabaseName(templateName)}`,
      );
      urls.push(url);
    }
  } finally {
    await client.end();
  }
  return urls;
}

/** Elimina las bases de los workers (nunca la plantilla ni la base principal). */
export async function dropWorkerDatabases(
  workerCount: number = resolveWorkerCount(),
  baseUrl: string = resolveBaseTestUrl(),
): Promise<void> {
  if (workerCount <= 1) return;
  assertTestDatabase(baseUrl);
  const baseName = databaseNameOf(baseUrl);
  const client = new pg.Client({
    connectionString: adminUrlOf(baseUrl),
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    for (let index = 1; index <= workerCount; index += 1) {
      const name = workerDatabaseName(baseName, index);
      assertTestDatabase(withDatabaseName(baseUrl, name));
      await client.query(`DROP DATABASE IF EXISTS ${quoteDatabaseName(name)} WITH (FORCE)`);
    }
  } finally {
    await client.end();
  }
}

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

function parseWorkersOption(raw: string): number {
  const workers = Number(raw);
  if (!Number.isInteger(workers) || workers < 1 || workers > 32) {
    throw new Error(`El número de workers debe ser un entero entre 1 y 32 (recibido: '${raw}').`);
  }
  return workers;
}

/**
 * Prepara las bases de los workers de E2E y escribe sus URL en `outFile` (HU-078, D13).
 * Con un solo worker usa la base de siempre.
 */
export async function prepareE2eDatabases(workers: number, outFile: string): Promise<string[]> {
  const urls = await prepareWorkerDatabases(workers);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ workers, urls }, null, 2), 'utf8');
  return urls;
}

// Si se ejecuta directamente como script de CLI
if (process.argv[1]?.includes('prepare-test-database')) {
  const templateUrl = optionValue('--template');
  const workersOption = optionValue('--workers');
  const dropOption = optionValue('--drop-workers');

  let run: Promise<string>;
  if (templateUrl) {
    run = prepareMigratedTemplate(templateUrl);
  } else if (dropOption) {
    run = dropWorkerDatabases(parseWorkersOption(dropOption)).then(
      () => 'bases de workers eliminadas',
    );
  } else if (workersOption) {
    const outFile = optionValue('--out');
    if (!outFile) {
      throw new Error('--workers requiere --out <archivo> para publicar las URL de las bases.');
    }
    run = prepareE2eDatabases(parseWorkersOption(workersOption), outFile).then((urls) =>
      urls.join(', '),
    );
  } else {
    run = prepareTestDatabase();
  }
  run
    .then((url) => {
      console.log(`Base de datos de pruebas preparada con éxito: ${url}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
