import crypto from 'node:crypto';
import pg from 'pg';
import { assertTestDatabase, getTestDatabaseUrl } from './assert-test-database.js';

/**
 * Sesión temporal de conexión asociada al rol restringido sigoa_app para pruebas automatizadas (RS-040, RNF-014).
 */
export interface AppRoleLoginSession {
  url: string;
  username: string;
  drop: () => Promise<void>;
}

/**
 * Aprovisiona un login temporal no superusuario miembro de sigoa_app en la base de datos de pruebas (RS-040, RNF-014).
 * Valida estrictamente que el destino termine en `_test`.
 */
export async function createAppRoleLogin(customAdminUrl?: string): Promise<AppRoleLoginSession> {
  const adminUrl = assertTestDatabase(customAdminUrl ?? getTestDatabaseUrl());
  const username = `sigoa_app_test_${crypto.randomBytes(4).toString('hex')}`;
  const password = crypto.randomBytes(16).toString('hex');

  const adminClient = new pg.Client({ connectionString: adminUrl });
  await adminClient.connect();

  try {
    await adminClient.query(`DROP ROLE IF EXISTS "${username}";`);
    await adminClient.query(
      `CREATE ROLE "${username}" WITH LOGIN PASSWORD '${password}' IN ROLE sigoa_app;`,
    );
  } catch (error) {
    await adminClient.end();
    throw new Error(
      `No se pudo aprovisionar el rol de prueba con privilegios sigoa_app: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  const appRoleUrl = new URL(adminUrl);
  appRoleUrl.username = username;
  appRoleUrl.password = password;

  return {
    drop: async () => {
      try {
        await adminClient.query(`DROP ROLE IF EXISTS "${username}";`);
      } finally {
        await adminClient.end();
      }
    },
    url: appRoleUrl.toString(),
    username,
  };
}
