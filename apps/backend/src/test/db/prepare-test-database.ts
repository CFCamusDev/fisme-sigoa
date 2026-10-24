import pg from 'pg';
import { execSync } from 'node:child_process';
import { getTestDatabaseUrl } from './assert-test-database.js';

export async function prepareTestDatabase(): Promise<string> {
  let testUrl: string;
  try {
    testUrl = getTestDatabaseUrl();
  } catch {
    const defaultTestUrl = 'postgresql://postgres:postgres@localhost:5432/sigoa_test?schema=public';
    process.env['TEST_DATABASE_URL'] = defaultTestUrl;
    testUrl = defaultTestUrl;
  }

  const parsed = new URL(testUrl);
  const dbName = parsed.pathname.replace(/^\//, '');

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
  } catch (error) {
    throw new Error(
      `No se pudo conectar a PostgreSQL para preparar la base de pruebas (${testUrl}). ` +
        `Asegúrate de que el contenedor Docker esté iniciado (docker run --name fisme-postgres ...). Detalle: ${
          error instanceof Error ? error.message : String(error)
        }`,
      { cause: error },
    );
  } finally {
    await client.end();
  }

  try {
    execSync('pnpm exec prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
    });
  } catch (error) {
    throw new Error(
      `Fallo al ejecutar 'prisma migrate deploy' en la base de pruebas: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  return testUrl;
}

// Si se ejecuta directamente como script de CLI
if (process.argv[1]?.includes('prepare-test-database')) {
  prepareTestDatabase()
    .then((url) => {
      console.log(`Base de datos de pruebas preparada con éxito: ${url}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
