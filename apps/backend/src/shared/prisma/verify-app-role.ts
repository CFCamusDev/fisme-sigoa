import type { PgSqlExecutor } from './provision-app-role.js';

/**
 * Error lanzado cuando la verificación de restricciones del rol de aplicación falla (RS-040, RNF-014).
 * Nunca contiene contraseñas ni cadenas de conexión.
 */
export class AppRoleVerificationError extends Error {
  public readonly violations: readonly string[];

  constructor(violations: string[]) {
    super(
      `El rol de base de datos de la aplicación no cumple con las restricciones de seguridad (RS-040):\n - ${violations.join(
        '\n - ',
      )}`,
    );
    this.name = 'AppRoleVerificationError';
    this.violations = Object.freeze([...violations]);
  }
}

export interface VerifyAppRoleResult {
  valid: true;
  user: string;
}

interface UserAttributesRow {
  current_user: string;
  rolsuper: boolean;
}

interface TablePrivilegeRow {
  can_select: boolean;
  can_insert: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_truncate: boolean;
}

interface TableOwnerRow {
  tablename: string;
}

/**
 * Tablas estrictamente append-only donde el rol de la aplicación tiene prohibido UPDATE, DELETE y TRUNCATE.
 */
export const APPEND_ONLY_TABLES = ['audit_logs'] as const;

/**
 * Verifica de forma introspectiva y no invasiva (mediante `has_table_privilege` y vistas del sistema)
 * que el rol con el que está conectado el cliente cumple las restricciones de seguridad de RS-040:
 * 1. No es superusuario.
 * 2. No es dueño de las tablas de auditoría ni de esquemas públicos.
 * 3. En `audit_logs` tiene SELECT e INSERT, pero NO UPDATE, DELETE ni TRUNCATE.
 * 4. En `audit_chain_heads` tiene SELECT, INSERT y UPDATE, pero NO DELETE ni TRUNCATE.
 */
export async function verifyAppRoleRestrictions(
  client: PgSqlExecutor,
): Promise<VerifyAppRoleResult> {
  const violations: string[] = [];

  // 1. Verificación de superusuario
  const userRes = await client.query<UserAttributesRow>(
    'SELECT current_user, rolsuper FROM pg_roles WHERE rolname = current_user;',
  );
  const currentUser = userRes.rows[0]?.current_user ?? 'unknown';
  const isSuperuser = userRes.rows[0]?.rolsuper ?? false;

  if (isSuperuser) {
    violations.push(`El rol de aplicación '${currentUser}' tiene privilegios de SUPERUSER`);
  }

  // 2. Verificación de titularidad de tablas
  const tablesRes = await client.query<TableOwnerRow>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user;",
  );
  if (tablesRes.rows.length > 0) {
    const tableList = tablesRes.rows.map((r) => r.tablename).join(', ');
    violations.push(
      `El rol de aplicación '${currentUser}' es dueño de las tablas (${tableList}); debe pertenecer al usuario de migraciones`,
    );
  }

  // 3. Verificación de privilegios en audit_logs (append-only)
  const auditLogsPrivs = await client.query<TablePrivilegeRow>(
    `SELECT
       has_table_privilege(current_user, 'audit_logs', 'SELECT') AS can_select,
       has_table_privilege(current_user, 'audit_logs', 'INSERT') AS can_insert,
       has_table_privilege(current_user, 'audit_logs', 'UPDATE') AS can_update,
       has_table_privilege(current_user, 'audit_logs', 'DELETE') AS can_delete,
       has_table_privilege(current_user, 'audit_logs', 'TRUNCATE') AS can_truncate;`,
  );
  const al = auditLogsPrivs.rows[0];
  if (al) {
    if (!al.can_select) violations.push("La tabla 'audit_logs' carece de permiso SELECT");
    if (!al.can_insert) violations.push("La tabla 'audit_logs' carece de permiso INSERT");
    if (al.can_update)
      violations.push("La tabla 'audit_logs' tiene permiso de UPDATE no permitido");
    if (al.can_delete)
      violations.push("La tabla 'audit_logs' tiene permiso de DELETE no permitido");
    if (al.can_truncate)
      violations.push("La tabla 'audit_logs' tiene permiso de TRUNCATE no permitido");
  }

  // 4. Verificación de privilegios en audit_chain_heads (puntero de cabeza)
  const chainHeadPrivs = await client.query<TablePrivilegeRow>(
    `SELECT
       has_table_privilege(current_user, 'audit_chain_heads', 'SELECT') AS can_select,
       has_table_privilege(current_user, 'audit_chain_heads', 'INSERT') AS can_insert,
       has_table_privilege(current_user, 'audit_chain_heads', 'UPDATE') AS can_update,
       has_table_privilege(current_user, 'audit_chain_heads', 'DELETE') AS can_delete,
       has_table_privilege(current_user, 'audit_chain_heads', 'TRUNCATE') AS can_truncate;`,
  );
  const ch = chainHeadPrivs.rows[0];
  if (ch) {
    if (!ch.can_select) violations.push("La tabla 'audit_chain_heads' carece de permiso SELECT");
    if (!ch.can_insert) violations.push("La tabla 'audit_chain_heads' carece de permiso INSERT");
    if (!ch.can_update) violations.push("La tabla 'audit_chain_heads' carece de permiso UPDATE");
    if (ch.can_delete)
      violations.push("La tabla 'audit_chain_heads' tiene permiso de DELETE no permitido");
    if (ch.can_truncate)
      violations.push("La tabla 'audit_chain_heads' tiene permiso de TRUNCATE no permitido");
  }

  if (violations.length > 0) {
    throw new AppRoleVerificationError(violations);
  }

  return { valid: true, user: currentUser };
}
