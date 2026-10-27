import { describe, expect, it } from 'vitest';
import type { PgSqlExecutor, SqlQueryResult } from './provision-app-role.js';
import { AppRoleVerificationError, verifyAppRoleRestrictions } from './verify-app-role.js';

interface PrivilegeRow {
  can_select: boolean;
  can_insert: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_truncate: boolean;
}

class MockVerifyPgClient implements PgSqlExecutor {
  public currentUser = 'sigoa_backend';
  public isSuperuser = false;
  public ownedTables: string[] = [];

  public auditLogsPrivileges: PrivilegeRow = {
    can_select: true,
    can_insert: true,
    can_update: false,
    can_delete: false,
    can_truncate: false,
  };

  public auditChainHeadsPrivileges: PrivilegeRow = {
    can_select: true,
    can_insert: true,
    can_update: true,
    can_delete: false,
    can_truncate: false,
  };

  async query<R = Record<string, unknown>>(sql: string): Promise<SqlQueryResult<R>> {
    if (sql.includes('SELECT current_user, rolsuper')) {
      return {
        rows: [
          {
            current_user: this.currentUser,
            rolsuper: this.isSuperuser,
          },
        ] as unknown as R[],
      };
    }

    if (sql.includes('SELECT tablename FROM pg_tables')) {
      return {
        rows: this.ownedTables.map((t) => ({ tablename: t })) as unknown as R[],
      };
    }

    if (sql.includes("'audit_logs'")) {
      return {
        rows: [this.auditLogsPrivileges] as unknown as R[],
      };
    }

    if (sql.includes("'audit_chain_heads'")) {
      return {
        rows: [this.auditChainHeadsPrivileges] as unknown as R[],
      };
    }

    return { rows: [] };
  }
}

describe('verifyAppRoleRestrictions (Unit, RS-040, RNF-014)', () => {
  it('passes verification when role has correct restricted privileges', async () => {
    const client = new MockVerifyPgClient();

    const result = await verifyAppRoleRestrictions(client);

    expect(result.valid).toBe(true);
    expect(result.user).toBe('sigoa_backend');
  });

  it('fails if the connected user is a SUPERUSER', async () => {
    const client = new MockVerifyPgClient();
    client.isSuperuser = true;

    await expect(verifyAppRoleRestrictions(client)).rejects.toThrow(AppRoleVerificationError);

    try {
      await verifyAppRoleRestrictions(client);
    } catch (error) {
      expect(error).toBeInstanceOf(AppRoleVerificationError);
      const appErr = error as AppRoleVerificationError;
      expect(appErr.violations).toEqual(
        expect.arrayContaining([expect.stringMatching(/SUPERUSER/i)]),
      );
    }
  });

  it('fails if the user owns tables in the public schema', async () => {
    const client = new MockVerifyPgClient();
    client.ownedTables = ['audit_logs', 'audit_chain_heads'];

    try {
      await verifyAppRoleRestrictions(client);
      expect.fail('Should have thrown AppRoleVerificationError');
    } catch (error) {
      expect(error).toBeInstanceOf(AppRoleVerificationError);
      const appErr = error as AppRoleVerificationError;
      expect(appErr.violations).toEqual(
        expect.arrayContaining([expect.stringMatching(/due[ñn]o de las tablas.*audit_logs/i)]),
      );
    }
  });

  it('fails if audit_logs has UPDATE, DELETE or TRUNCATE permissions', async () => {
    const client = new MockVerifyPgClient();
    client.auditLogsPrivileges.can_update = true;
    client.auditLogsPrivileges.can_delete = true;

    try {
      await verifyAppRoleRestrictions(client);
      expect.fail('Should have thrown AppRoleVerificationError');
    } catch (error) {
      expect(error).toBeInstanceOf(AppRoleVerificationError);
      const appErr = error as AppRoleVerificationError;
      expect(appErr.violations.some((v) => /audit_logs.*UPDATE/i.test(v))).toBe(true);
      expect(appErr.violations.some((v) => /audit_logs.*DELETE/i.test(v))).toBe(true);
    }
  });

  it('fails if audit_logs lacks SELECT or INSERT permissions', async () => {
    const client = new MockVerifyPgClient();
    client.auditLogsPrivileges.can_select = false;
    client.auditLogsPrivileges.can_insert = false;

    try {
      await verifyAppRoleRestrictions(client);
      expect.fail('Should have thrown AppRoleVerificationError');
    } catch (error) {
      expect(error).toBeInstanceOf(AppRoleVerificationError);
      const appErr = error as AppRoleVerificationError;
      expect(appErr.violations.some((v) => /audit_logs.*SELECT/i.test(v))).toBe(true);
      expect(appErr.violations.some((v) => /audit_logs.*INSERT/i.test(v))).toBe(true);
    }
  });

  it('fails if audit_chain_heads has DELETE or TRUNCATE permissions', async () => {
    const client = new MockVerifyPgClient();
    client.auditChainHeadsPrivileges.can_delete = true;
    client.auditChainHeadsPrivileges.can_truncate = true;

    try {
      await verifyAppRoleRestrictions(client);
      expect.fail('Should have thrown AppRoleVerificationError');
    } catch (error) {
      expect(error).toBeInstanceOf(AppRoleVerificationError);
      const appErr = error as AppRoleVerificationError;
      expect(appErr.violations.some((v) => /audit_chain_heads.*DELETE/i.test(v))).toBe(true);
      expect(appErr.violations.some((v) => /audit_chain_heads.*TRUNCATE/i.test(v))).toBe(true);
    }
  });
});
