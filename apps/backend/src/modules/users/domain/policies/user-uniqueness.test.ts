import { describe, expect, it } from 'vitest';
import { assertUserIdentityAvailable } from './user-uniqueness.js';
import { UserDniAlreadyExistsError, UserEmailAlreadyExistsError } from '../errors/index.js';

describe('UserUniquenessPolicy (T-003-03, T-003-18, CA2, RF-003)', () => {
  const baseParams = {
    email: 'juan.perez@untrm.edu.pe',
    dni: '12345678',
    byEmail: null,
    byDni: null,
  };

  it('accepts a free email and dni', () => {
    expect(() =>
      assertUserIdentityAvailable({
        ...baseParams,
      }),
    ).not.toThrow();
  });

  it('rejects a duplicated email', () => {
    expect(() =>
      assertUserIdentityAvailable({
        ...baseParams,
        byEmail: { id: 'other-user-uuid' },
      }),
    ).toThrow(UserEmailAlreadyExistsError);
  });

  it('rejects a duplicated dni', () => {
    expect(() =>
      assertUserIdentityAvailable({
        ...baseParams,
        byDni: { id: 'other-user-uuid' },
      }),
    ).toThrow(UserDniAlreadyExistsError);
  });

  it('reports the email first when both are duplicated', () => {
    expect(() =>
      assertUserIdentityAvailable({
        ...baseParams,
        byEmail: { id: 'user-email-uuid' },
        byDni: { id: 'user-dni-uuid' },
      }),
    ).toThrow(UserEmailAlreadyExistsError);
  });

  it('ignores the user being edited', () => {
    expect(() =>
      assertUserIdentityAvailable({
        ...baseParams,
        byEmail: { id: 'current-user-uuid' },
        byDni: { id: 'current-user-uuid' },
        exceptUserId: 'current-user-uuid',
      }),
    ).not.toThrow();
  });

  it('error messages do not include personal data', () => {
    let emailErr: Error | null = null;
    try {
      assertUserIdentityAvailable({
        ...baseParams,
        byEmail: { id: 'other-user-uuid' },
      });
    } catch (err) {
      emailErr = err as Error;
    }

    expect(emailErr).toBeInstanceOf(UserEmailAlreadyExistsError);
    expect(emailErr?.message).not.toContain(baseParams.email);
    expect(emailErr?.message).toBe('Ya existe un usuario con ese correo.');

    let dniErr: Error | null = null;
    try {
      assertUserIdentityAvailable({
        ...baseParams,
        byDni: { id: 'other-user-uuid' },
      });
    } catch (err) {
      dniErr = err as Error;
    }

    expect(dniErr).toBeInstanceOf(UserDniAlreadyExistsError);
    expect(dniErr?.message).not.toContain(baseParams.dni);
    expect(dniErr?.message).toBe('Ya existe un usuario con ese DNI.');
  });
});
