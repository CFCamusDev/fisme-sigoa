import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertTestDatabase, getTestDatabaseUrl } from '../../test/db/assert-test-database.js';
import { provisionAppRole } from './provision-app-role.js';
import { AppRoleVerificationError, verifyAppRoleRestrictions } from './verify-app-role.js';

describe('AppRole Provisioning & Verification Integration (PostgreSQL real, RS-040, RNF-014)', () => {
  const adminUrl = assertTestDatabase(getTestDatabaseUrl());
  let adminClient: pg.Client;
  const createdRoles: string[] = [];

  function buildUserUrl(username: string, password: string): string {
    const url = new URL(adminUrl);
    url.username = username;
    url.password = password;
    return url.toString();
  }

  beforeAll(async () => {
    adminClient = new pg.Client({ connectionString: adminUrl });
    await adminClient.connect();
  });

  afterAll(async () => {
    for (const role of createdRoles) {
      await adminClient.query(`DROP ROLE IF EXISTS "${role}";`).catch(() => {});
    }
    await adminClient.end();
  });

  it('provisions an idempotent restricted login and rotates password cleanly', async () => {
    const username = `sigoa_app_test_${crypto.randomBytes(4).toString('hex')}`;
    createdRoles.push(username);

    const initialPassword = `initial_pass_${crypto.randomBytes(8).toString('hex')}`;
    const rotatedPassword = `rotated_pass_${crypto.randomBytes(8).toString('hex')}`;

    // Primera ejecución: CREATED
    const res1 = await provisionAppRole(adminClient, {
      user: username,
      password: initialPassword,
    });
    expect(res1.action).toBe('CREATED');
    expect(res1.user).toBe(username);

    // Conexión exitosa con la contraseña inicial
    const clientInitial = new pg.Client({
      connectionString: buildUserUrl(username, initialPassword),
    });
    await clientInitial.connect();
    await clientInitial.end();

    // Segunda ejecución (idempotente): UPDATED con contraseña rotada
    const res2 = await provisionAppRole(adminClient, {
      user: username,
      password: rotatedPassword,
    });
    expect(res2.action).toBe('UPDATED');

    // La contraseña anterior ahora es rechazada
    const clientOld = new pg.Client({
      connectionString: buildUserUrl(username, initialPassword),
    });
    await expect(clientOld.connect()).rejects.toThrow(/password authentication failed/i);

    // La nueva contraseña conecta con éxito
    const clientNew = new pg.Client({
      connectionString: buildUserUrl(username, rotatedPassword),
    });
    await clientNew.connect();
    await clientNew.end();
  });

  it('verifies that the provisioned login satisfies all security restrictions', async () => {
    const username = `sigoa_app_test_${crypto.randomBytes(4).toString('hex')}`;
    createdRoles.push(username);
    const password = `test_secure_pass_${crypto.randomBytes(8).toString('hex')}`;

    await provisionAppRole(adminClient, { user: username, password });

    const appClient = new pg.Client({
      connectionString: buildUserUrl(username, password),
    });
    await appClient.connect();

    try {
      const verification = await verifyAppRoleRestrictions(appClient);
      expect(verification.valid).toBe(true);
      expect(verification.user).toBe(username);
    } finally {
      await appClient.end();
    }
  });

  it('rejects the owner role because it is a superuser and/or table owner', async () => {
    await expect(verifyAppRoleRestrictions(adminClient)).rejects.toThrow(AppRoleVerificationError);

    try {
      await verifyAppRoleRestrictions(adminClient);
    } catch (error) {
      expect(error).toBeInstanceOf(AppRoleVerificationError);
      const appErr = error as AppRoleVerificationError;
      expect(appErr.violations.length).toBeGreaterThan(0);
      expect(
        appErr.violations.some((v) => /SUPERUSER/i.test(v) || /due[ñn]o de las tablas/i.test(v)),
      ).toBe(true);
    }
  });

  it('reports a login granted too many privileges when UPDATE is granted on audit_logs', async () => {
    const username = `sigoa_app_test_${crypto.randomBytes(4).toString('hex')}`;
    createdRoles.push(username);
    const password = `test_pass_violation_${crypto.randomBytes(8).toString('hex')}`;

    await provisionAppRole(adminClient, { user: username, password });

    // Otorgamos indebidamente UPDATE al rol
    await adminClient.query(`GRANT UPDATE ON audit_logs TO "${username}";`);

    const appClient = new pg.Client({
      connectionString: buildUserUrl(username, password),
    });
    await appClient.connect();

    try {
      await expect(verifyAppRoleRestrictions(appClient)).rejects.toThrow(AppRoleVerificationError);
      try {
        await verifyAppRoleRestrictions(appClient);
      } catch (error) {
        expect(error).toBeInstanceOf(AppRoleVerificationError);
        const appErr = error as AppRoleVerificationError;
        expect(appErr.violations.some((v) => /audit_logs.*UPDATE/i.test(v))).toBe(true);
      }
    } finally {
      await appClient.end();
    }
  });
});
