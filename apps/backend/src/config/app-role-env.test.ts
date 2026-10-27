import { describe, expect, it } from 'vitest';
import { appRoleEnvSchema, loadAppRoleEnv } from './app-role-env.js';

describe('AppRoleEnv Schema (Unit, RS-040, RNF-014, RNF-010)', () => {
  const validBase = {
    DATABASE_URL: 'postgresql://postgres:secret_owner_pass@localhost:5432/sigoa_dev?schema=public',
    APP_DB_USER: 'sigoa_backend',
    APP_DB_PASSWORD: 'sigoa_backend_dev_pass_123',
  };

  it('accepts a valid configuration', () => {
    const result = loadAppRoleEnv(validBase);
    expect(result).toEqual({
      databaseUrl: validBase.DATABASE_URL,
      appDbUser: 'sigoa_backend',
      appDbPassword: 'sigoa_backend_dev_pass_123',
    });
  });

  it('rejects reserved role names (postgres, sigoa_app, public)', () => {
    for (const reserved of ['postgres', 'sigoa_app', 'public']) {
      const parsed = appRoleEnvSchema.safeParse({
        ...validBase,
        APP_DB_USER: reserved,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toMatch(/reservado/i);
      }
    }
  });

  it('rejects an invalid APP_DB_USER format (uppercase, special chars, too short)', () => {
    const invalidUsers = ['SigoaUser', 'us', 'sigoa-user', '1user', ''];
    for (const invalid of invalidUsers) {
      const parsed = appRoleEnvSchema.safeParse({
        ...validBase,
        APP_DB_USER: invalid,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('rejects APP_DB_USER if it is identical to the owner user in DATABASE_URL', () => {
    const parsed = appRoleEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://sigoa_backend:secret@localhost:5432/sigoa_dev',
      APP_DB_USER: 'sigoa_backend',
      APP_DB_PASSWORD: 'valid_password_16_chars',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/igual al usuario de conexi[oó]n due[ñn]o/i);
    }
  });

  it('rejects APP_DB_PASSWORD shorter than 16 characters or longer than 128', () => {
    const shortPass = appRoleEnvSchema.safeParse({
      ...validBase,
      APP_DB_PASSWORD: 'short_pass_1234',
    });
    expect(shortPass.success).toBe(false);

    const longPass = appRoleEnvSchema.safeParse({
      ...validBase,
      APP_DB_PASSWORD: 'a'.repeat(129),
    });
    expect(longPass.success).toBe(false);
  });

  it('rejects APP_DB_PASSWORD containing URL-unsafe characters (@, :, /, %, spaces)', () => {
    const unsafePasswords = [
      'pass_with_at_sign@123',
      'pass:with:colon_1234',
      'pass/with/slash_1234',
      'pass%with%percent123',
      'pass with spaces 1234',
    ];

    for (const unsafe of unsafePasswords) {
      const parsed = appRoleEnvSchema.safeParse({
        ...validBase,
        APP_DB_PASSWORD: unsafe,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('throws a descriptive error in loadAppRoleEnv without exposing sensitive values', () => {
    expect(() =>
      loadAppRoleEnv({
        DATABASE_URL: 'not-a-valid-url',
        APP_DB_USER: 'invalid',
        APP_DB_PASSWORD: 'short',
      }),
    ).toThrow(/variables de entorno del rol de aplicaci[oó]n inv[aá]lidas/i);
  });
});
