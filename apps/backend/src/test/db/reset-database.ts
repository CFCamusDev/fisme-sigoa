import { getPrismaClient } from '../../shared/prisma/prisma-client.js';
import { createTestEnv } from '../test-env.js';
import { getTestDatabaseUrl } from './assert-test-database.js';

/** Tablas del esquema `public` por base de datos (se consultan una vez por proceso). */
const tablesByDatabase = new Map<string, string[]>();

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Deja la base de pruebas vacía.
 *
 * Por defecto es incremental: consulta una vez la lista de tablas y, en cada llamada, trunca
 * solo las que tienen filas. `TEST_DB_RESET=truncate` restaura el `TRUNCATE` total anterior.
 */
export async function resetDatabase(): Promise<void> {
  const databaseUrl = getTestDatabaseUrl();
  const testEnv = createTestEnv({ DATABASE_URL: databaseUrl });
  const prisma = getPrismaClient(testEnv);

  let tables = tablesByDatabase.get(databaseUrl);
  if (!tables) {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
    `;
    tables = rows.map((row) => row.tablename);
    tablesByDatabase.set(databaseUrl, tables);
  }

  if (tables.length === 0) return;

  let dirtyTables = tables;
  if (process.env['TEST_DB_RESET'] !== 'truncate') {
    const probe = tables
      .map(
        (name) =>
          `SELECT ${quoteLiteral(name)} AS tablename WHERE EXISTS (SELECT 1 FROM ${quoteIdentifier(name)})`,
      )
      .join(' UNION ALL ');
    const dirty = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(probe);
    dirtyTables = dirty.map((row) => row.tablename);
  }

  if (dirtyTables.length > 0) {
    const tableNames = dirtyTables.map(quoteIdentifier).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
  }
}
