/**
 * Resultado de una consulta SQL genérica para el ejecutor mínimo.
 */
export interface SqlQueryResult<R = Record<string, unknown>> {
  rows: R[];
}

/**
 * Interfaz mínima para ejecutar consultas SQL (compatible con pg.Client y pg.PoolClient).
 */
export interface PgSqlExecutor {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlQueryResult<R>>;
}

export interface ProvisionAppRoleOptions {
  user: string;
  password: string;
}

export interface ProvisionAppRoleResult {
  user: string;
  action: 'CREATED' | 'UPDATED';
}

/**
 * Aprovisiona de forma idempotente el login de base de datos para la aplicación (RS-040, RNF-014, RNF-010).
 *
 * Se conecta con privilegios de dueño y:
 * 1. Verifica la existencia previa del rol de grupo 'sigoa_app' (creado por migraciones).
 * 2. Comprueba si el rol login ya existe.
 * 3. Ejecuta CREATE o ALTER dentro de una transacción, usando `format('%I', '%L')` en PostgreSQL
 *    para que la contraseña viaje estrictamente parametrizada y no se concatene en el cliente.
 * 4. Garantiza que el rol no sea superusuario ni posea privilegios administrativos, y asegura
 *    su membresía en el grupo `sigoa_app`.
 */
export async function provisionAppRole(
  client: PgSqlExecutor,
  options: ProvisionAppRoleOptions,
): Promise<ProvisionAppRoleResult> {
  const { user, password } = options;

  // 1. Verificación de existencia del rol de grupo sigoa_app
  const groupCheck = await client.query<{ '1': number }>(
    "SELECT 1 FROM pg_roles WHERE rolname = 'sigoa_app';",
  );
  if (groupCheck.rows.length === 0) {
    throw new Error(
      "No existe el rol de grupo 'sigoa_app'. Ejecute las migraciones de Prisma primero.",
    );
  }

  // 2. Comprobación de existencia del usuario login
  const userCheck = await client.query<{ '1': number }>(
    'SELECT 1 FROM pg_roles WHERE rolname = $1;',
    [user],
  );
  const exists = userCheck.rows.length > 0;

  await client.query('BEGIN;');

  try {
    if (!exists) {
      // Creación del rol con parámetros seguros en el motor PostgreSQL
      const formatResult = await client.query<{ ddl: string }>(
        "SELECT format('CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS IN ROLE sigoa_app;', $1::text, $2::text) AS ddl;",
        [user, password],
      );
      const createSql = formatResult.rows[0]?.ddl;
      if (!createSql) {
        throw new Error('PostgreSQL format no devolvió la sentencia DDL de creación de rol');
      }
      await client.query(createSql);

      await client.query('COMMIT;');
      return { user, action: 'CREATED' };
    }

    // Actualización de contraseña y restricciones
    const formatAlterResult = await client.query<{ ddl: string }>(
      "SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;', $1::text, $2::text) AS ddl;",
      [user, password],
    );
    const alterSql = formatAlterResult.rows[0]?.ddl;
    if (!alterSql) {
      throw new Error('PostgreSQL format no devolvió la sentencia DDL de modificación de rol');
    }
    await client.query(alterSql);

    // Asegurar membresía en el grupo sigoa_app
    const formatGrantResult = await client.query<{ ddl: string }>(
      "SELECT format('GRANT sigoa_app TO %I;', $1::text) AS ddl;",
      [user],
    );
    const grantSql = formatGrantResult.rows[0]?.ddl;
    if (!grantSql) {
      throw new Error('PostgreSQL format no devolvió la sentencia DDL de otorgamiento de rol');
    }
    await client.query(grantSql);

    await client.query('COMMIT;');
    return { user, action: 'UPDATED' };
  } catch (error) {
    await client.query('ROLLBACK;').catch(() => {});
    const safeMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Fallo al aprovisionar el rol de aplicación '${user}': ${safeMessage}`, {
      cause: error,
    });
  }
}
