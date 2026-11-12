import { describe, expect, it } from 'vitest';
import { loadBootstrapAdminEnv, splitFullName } from './bootstrap-admin-env.js';

const SECRET_PASSWORD = 'Clave-Secreta-2026';

const validEnv = {
  ADMIN_EMAIL: 'Admin.Prueba@example.test',
  ADMIN_FULL_NAME: 'Ana Maria Quispe Rojas',
  ADMIN_DNI: '12345678',
  ADMIN_INITIAL_PASSWORD: SECRET_PASSWORD,
};

function issuesOf(env: Record<string, string | undefined>) {
  const result = loadBootstrapAdminEnv(env);
  if (result.ok) {
    throw new Error('Se esperaba un resultado inválido');
  }
  return result.issues;
}

describe('loadBootstrapAdminEnv (RNF-003, RNF-039)', () => {
  it('accepts valid values and lowercases the email', () => {
    const result = loadBootstrapAdminEnv(validEnv);
    expect(result).toEqual({
      ok: true,
      value: {
        email: 'admin.prueba@example.test',
        names: 'Ana Maria',
        firstSurname: 'Quispe',
        secondSurname: 'Rojas',
        dni: '12345678',
        password: SECRET_PASSWORD,
      },
    });
  });

  it.each([
    ['Ana Quispe', { names: 'Ana', firstSurname: 'Quispe', secondSurname: null }],
    ['Ana Quispe Rojas', { names: 'Ana', firstSurname: 'Quispe', secondSurname: 'Rojas' }],
    [
      'Ana Maria Lucia Quispe Rojas',
      { names: 'Ana Maria Lucia', firstSurname: 'Quispe', secondSurname: 'Rojas' },
    ],
  ])('splits "%s" into names and surnames', (fullName, expected) => {
    expect(splitFullName(fullName)).toEqual(expected);
  });

  it('rejects a one-word name', () => {
    const issues = issuesOf({ ...validEnv, ADMIN_FULL_NAME: 'Ana' });
    expect(issues.map((i) => i.variable)).toEqual(['ADMIN_FULL_NAME']);
  });

  it.each([
    ['too short (9 characters)', 'Abcdefgh1'],
    ['without a letter', '1234567890'],
    ['without a number', 'Abcdefghijk'],
    ['longer than 128 characters', `a1${'x'.repeat(128)}`],
  ])('rejects a password %s naming the variable', (_label, password) => {
    const issues = issuesOf({ ...validEnv, ADMIN_INITIAL_PASSWORD: password });
    expect(issues.map((i) => i.variable)).toEqual(['ADMIN_INITIAL_PASSWORD']);
    expect(JSON.stringify(issues)).not.toContain(password);
  });

  it.each(['no-es-correo', 'a@b', `${'a'.repeat(250)}@example.test`])(
    'rejects an invalid email',
    (email) => {
      const issues = issuesOf({ ...validEnv, ADMIN_EMAIL: email });
      expect(issues.map((i) => i.variable)).toEqual(['ADMIN_EMAIL']);
      expect(JSON.stringify(issues)).not.toContain(email);
    },
  );

  it.each(['1234567', '123456789', '1234567a', 'abcdefgh'])('rejects DNI "%s"', (dni) => {
    const issues = issuesOf({ ...validEnv, ADMIN_DNI: dni });
    expect(issues.map((i) => i.variable)).toEqual(['ADMIN_DNI']);
  });

  it('treats an empty string as an absent variable', () => {
    const issues = issuesOf({ ...validEnv, ADMIN_EMAIL: '', ADMIN_DNI: '   ' });
    expect(issues.map((i) => i.variable).sort()).toEqual(['ADMIN_DNI', 'ADMIN_EMAIL']);
  });

  it('reports every variable when all are missing', () => {
    const issues = issuesOf({});
    expect(issues.map((i) => i.variable).sort()).toEqual([
      'ADMIN_DNI',
      'ADMIN_EMAIL',
      'ADMIN_FULL_NAME',
      'ADMIN_INITIAL_PASSWORD',
    ]);
  });

  it('never includes the received password in any issue message', () => {
    const issues = issuesOf({ ...validEnv, ADMIN_INITIAL_PASSWORD: 'corta1', ADMIN_DNI: 'xx' });
    expect(JSON.stringify(issues)).not.toContain('corta1');
  });
});
