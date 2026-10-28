import { describe, expect, it } from 'vitest';
import { runProvisioningAppRole } from './provision-app-role.js';

describe('runProvisioningAppRole (Unit, RS-040, RNF-014, RNF-030)', () => {
  // URL inalcanzable: si intentara conectar a PostgreSQL fallaría con ECONNREFUSED
  const unreachableDatabaseUrl =
    'postgresql://test_owner:secret_pass_123@127.0.0.1:1/sigoa_test?schema=public';

  const validBaseEnv = {
    DATABASE_URL: unreachableDatabaseUrl,
    APP_DB_USER: 'sigoa_backend_test',
    APP_DB_PASSWORD: 'secure_password_16_chars',
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
  };

  it('rejects when APP_DB_USER is missing', async () => {
    await expect(
      runProvisioningAppRole({
        ...validBaseEnv,
        APP_DB_USER: '',
      }),
    ).rejects.toThrow(/variables de entorno del rol de aplicaci[oó]n inv[aá]lidas/i);
  });

  it('rejects when APP_DB_PASSWORD is missing', async () => {
    await expect(
      runProvisioningAppRole({
        ...validBaseEnv,
        APP_DB_PASSWORD: '',
      }),
    ).rejects.toThrow(/variables de entorno del rol de aplicaci[oó]n inv[aá]lidas/i);
  });

  it('rejects reserved role names (postgres, sigoa_app, public)', async () => {
    for (const reserved of ['postgres', 'sigoa_app', 'public']) {
      await expect(
        runProvisioningAppRole({
          ...validBaseEnv,
          APP_DB_USER: reserved,
        }),
      ).rejects.toThrow(/reservado/i);
    }
  });

  it('rejects a role name equal to the owner user of DATABASE_URL', async () => {
    await expect(
      runProvisioningAppRole({
        ...validBaseEnv,
        APP_DB_USER: 'test_owner',
      }),
    ).rejects.toThrow(/igual al usuario de conexi[oó]n due[ñn]o/i);
  });

  it('rejects a password with unsafe characters or shorter than 16', async () => {
    const invalidPasswords = [
      'short_pass',
      'pass_with_at_sign@123',
      'pass/with/slash_123',
      'pass with spaces 1234',
    ];

    for (const invalidPass of invalidPasswords) {
      await expect(
        runProvisioningAppRole({
          ...validBaseEnv,
          APP_DB_PASSWORD: invalidPass,
        }),
      ).rejects.toThrow(/variables de entorno del rol de aplicaci[oó]n inv[aá]lidas/i);
    }
  });

  it('never includes the password in the error message', async () => {
    const sensitivePassword = 'super_secret_forbidden_pass_123';
    try {
      await runProvisioningAppRole({
        ...validBaseEnv,
        APP_DB_USER: 'postgres', // Falla por usuario reservado
        APP_DB_PASSWORD: sensitivePassword,
      });
      expect.fail('Debería haber lanzado un error de validación');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(sensitivePassword);
    }
  });
});
