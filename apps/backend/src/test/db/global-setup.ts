import pg from 'pg';
import { execSync } from 'node:child_process';
import { getTestDatabaseUrl } from './assert-test-database.js';

export async function setup(): Promise<void> {
  let testUrl: string;
  try {
    testUrl = getTestDatabaseUrl();
  } catch {
    // Si no está definida ninguna variable, asignamos el valor local estándar de pruebas
    const defaultTestUrl = 'postgresql://postgres:postgres@localhost:5432/sigoa_test?schema=public';
    process.env['TEST_DATABASE_URL'] = defaultTestUrl;
    testUrl = defaultTestUrl;
  }

  const parsed = new URL(testUrl);
  const dbName = parsed.pathname.replace(/^\//, '');

  // Conectamos a la base administrativa 'postgres' para asegurar que la base de datos de test exista
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

  // Desplegamos migraciones contra la base de datos de pruebas
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
}
