import { describe, expect, it } from 'vitest';
import { provisionAppRole, type PgSqlExecutor, type SqlQueryResult } from './provision-app-role.js';

class MockPgClient implements PgSqlExecutor {
  public queries: Array<{ sql: string; values?: unknown[] }> = [];
  public roleExists = false;
  public groupRoleExists = true;

  async query<R = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<SqlQueryResult<R>> {
    this.queries.push({ sql, values });

    // Consulta de existencia de sigoa_app
    if (sql.includes("WHERE rolname = 'sigoa_app'")) {
      return {
        rows: (this.groupRoleExists ? [{ '1': 1 }] : []) as unknown as R[],
      };
    }

    // Consulta de existencia del login de usuario
    if (sql.includes('WHERE rolname = $1')) {
      return {
        rows: (this.roleExists ? [{ '1': 1 }] : []) as unknown as R[],
      };
    }

    // Simulación de la función format de PostgreSQL
    if (sql.includes('SELECT format(')) {
      if (sql.includes('CREATE ROLE')) {
        const user = values?.[0];
        const pass = values?.[1];
        return {
          rows: [
            {
              ddl: `CREATE ROLE "${user}" WITH LOGIN PASSWORD '${pass}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS IN ROLE sigoa_app;`,
            },
          ] as unknown as R[],
        };
      }
      if (sql.includes('ALTER ROLE')) {
        const user = values?.[0];
        const pass = values?.[1];
        return {
          rows: [
            {
              ddl: `ALTER ROLE "${user}" WITH LOGIN PASSWORD '${pass}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;`,
            },
          ] as unknown as R[],
        };
      }
      if (sql.includes('GRANT sigoa_app')) {
        const user = values?.[0];
        return {
          rows: [{ ddl: `GRANT sigoa_app TO "${user}";` }] as unknown as R[],
        };
      }
    }

    return { rows: [] };
  }
}

describe('provisionAppRole (Unit, RS-040, RNF-014, RNF-010)', () => {
  it('throws an error if sigoa_app group role does not exist', async () => {
    const mockClient = new MockPgClient();
    mockClient.groupRoleExists = false;

    await expect(
      provisionAppRole(mockClient, {
        user: 'sigoa_backend',
        password: 'sigoa_backend_dev_pass_123',
      }),
    ).rejects.toThrow(/No existe el rol de grupo 'sigoa_app'/i);
  });

  it('creates the role inside a transaction when it does not exist', async () => {
    const mockClient = new MockPgClient();
    mockClient.roleExists = false;

    const result = await provisionAppRole(mockClient, {
      user: 'sigoa_backend',
      password: 'sigoa_backend_dev_pass_123',
    });

    expect(result.action).toBe('CREATED');
    expect(result.user).toBe('sigoa_backend');

    // Comprobamos la secuencia de comandos ejecutados
    const executedSqls = mockClient.queries.map((q) => q.sql);
    expect(executedSqls).toContain('BEGIN;');
    expect(executedSqls).toContain('COMMIT;');

    // Comprobamos que format se llamó de forma parametrizada (sin concatenar password en cliente)
    const formatQuery = mockClient.queries.find((q) => q.sql.includes('SELECT format('));
    expect(formatQuery?.values).toEqual(['sigoa_backend', 'sigoa_backend_dev_pass_123']);
  });

  it('alters the role and ensures sigoa_app membership when role already exists', async () => {
    const mockClient = new MockPgClient();
    mockClient.roleExists = true;

    const result = await provisionAppRole(mockClient, {
      user: 'sigoa_backend',
      password: 'new_password_rotated_123',
    });

    expect(result.action).toBe('UPDATED');
    expect(result.user).toBe('sigoa_backend');

    const executedSqls = mockClient.queries.map((q) => q.sql);
    expect(executedSqls).toContain('BEGIN;');
    expect(executedSqls).toContain('COMMIT;');

    // Formateó tanto ALTER como GRANT
    const alterQuery = mockClient.queries.find((q) => q.sql.includes('ALTER ROLE'));
    expect(alterQuery?.values).toEqual(['sigoa_backend', 'new_password_rotated_123']);

    const grantQuery = mockClient.queries.find((q) => q.sql.includes('GRANT sigoa_app'));
    expect(grantQuery?.values).toEqual(['sigoa_backend']);
  });

  it('rolls back the transaction if a query fails and sanitizes error', async () => {
    const mockClient = new MockPgClient();
    const calls: string[] = [];
    mockClient.query = async <R = Record<string, unknown>>(
      sql: string,
    ): Promise<SqlQueryResult<R>> => {
      calls.push(sql);
      if (sql.includes("WHERE rolname = 'sigoa_app'")) {
        return { rows: [{ '1': 1 }] as unknown as R[] };
      }
      if (sql === 'BEGIN;') return { rows: [] };
      if (sql.includes('WHERE rolname = $1')) return { rows: [] };
      if (sql.includes('SELECT format(')) {
        throw new Error('Database disk full');
      }
      if (sql === 'ROLLBACK;') return { rows: [] };
      return { rows: [] };
    };

    await expect(
      provisionAppRole(mockClient, {
        user: 'sigoa_backend',
        password: 'secret_dev_password_123',
      }),
    ).rejects.toThrow(/Database disk full/);

    expect(calls).toContain('ROLLBACK;');
  });
});
