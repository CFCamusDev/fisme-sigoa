import { describe, it, expect } from 'vitest';
import { PasswordPolicy } from './password-policy.js';
import { WeakPasswordError } from '../errors/weak-password-error.js';
import { passwordSchema } from '@sigoa/shared';

describe('PasswordPolicy (T-004-02, T-004-11, RF-004, RNF-003, CA3)', () => {
  it('accepts exactly 10 characters with a letter and a number', () => {
    const valid = 'a123456789';
    expect(PasswordPolicy.evaluate(valid)).toEqual([]);
    expect(() => PasswordPolicy.assert(valid)).not.toThrow();
  });

  it('rejects 9 characters (boundary case)', () => {
    const details = PasswordPolicy.evaluate('a12345678');
    expect(details).toEqual([
      { path: 'password', message: 'La contraseña debe tener al menos 10 caracteres' },
    ]);
  });

  it('rejects letters only', () => {
    const details = PasswordPolicy.evaluate('SolamenteLetras');
    expect(details).toEqual([
      { path: 'password', message: 'La contraseña debe incluir al menos un número' },
    ]);
  });

  it('rejects numbers only', () => {
    const details = PasswordPolicy.evaluate('1234567890123');
    expect(details).toEqual([
      { path: 'password', message: 'La contraseña debe incluir al menos una letra' },
    ]);
  });

  it('accepts accented letters and spaces', () => {
    const valid = 'Contraseña 2026';
    expect(PasswordPolicy.evaluate(valid)).toEqual([]);
    expect(() => PasswordPolicy.assert(valid)).not.toThrow();
  });

  it('rejects more than 128 characters', () => {
    const longPassword = 'A1' + 'a'.repeat(127);
    const details = PasswordPolicy.evaluate(longPassword);
    expect(details).toEqual([
      { path: 'password', message: 'La contraseña no puede exceder 128 caracteres' },
    ]);
  });

  it('assert throws WeakPasswordError with the list of violated rules', () => {
    expect(() => PasswordPolicy.assert('123')).toThrow(WeakPasswordError);
    try {
      PasswordPolicy.assert('123');
    } catch (error) {
      expect(error).toBeInstanceOf(WeakPasswordError);
      const weakError = error as WeakPasswordError;
      expect(weakError.code).toBe('VALIDATION_ERROR');
      expect(weakError.httpStatus).toBe(400);
      expect(weakError.details).toBeDefined();
      expect(weakError.details).toHaveLength(2);
      const messages = weakError.details?.map((d) => d.message);
      expect(messages).toContain('La contraseña debe tener al menos 10 caracteres');
      expect(messages).toContain('La contraseña debe incluir al menos una letra');
    }
  });

  it('handles empty string as hostile input', () => {
    const details = PasswordPolicy.evaluate('');
    expect(details.length).toBeGreaterThan(0);
    const messages = details.map((d) => d.message);
    expect(messages).toContain('La contraseña debe tener al menos 10 caracteres');
    expect(messages).toContain('La contraseña debe incluir al menos una letra');
    expect(messages).toContain('La contraseña debe incluir al menos un número');
  });

  it('matches the shared passwordSchema for a table of cases (parity test, D1)', () => {
    const cases = [
      'Valida1234!',
      'corta1',
      'sololetraslargas',
      '12345678901',
      'Contraseña con Espacio 1',
      'A1' + 'x'.repeat(127),
      '',
    ];

    for (const testPassword of cases) {
      const policyDetails = PasswordPolicy.evaluate(testPassword);
      const schemaResult = passwordSchema.safeParse(testPassword);

      if (policyDetails.length === 0) {
        expect(schemaResult.success).toBe(true);
      } else {
        expect(schemaResult.success).toBe(false);
        if (!schemaResult.success) {
          const schemaMessages = schemaResult.error.issues.map((i) => i.message);
          const policyMessages = policyDetails.map((d) => d.message);
          expect(policyMessages.sort()).toEqual(schemaMessages.sort());
        }
      }
    }
  });
});
