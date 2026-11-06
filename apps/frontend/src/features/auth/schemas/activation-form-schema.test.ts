import { describe, expect, it } from 'vitest';
import { activationFormSchema } from './activation-form-schema';

describe('activationFormSchema (HU-004, T-004-10, CA3)', () => {
  it('accepts a matching valid password', () => {
    const validData = {
      password: 'StrongPassword123*',
      confirmPassword: 'StrongPassword123*',
    };

    const result = activationFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('rejects a confirmation that does not match', () => {
    const data = {
      password: 'StrongPassword123*',
      confirmPassword: 'DifferentPassword123*',
    };

    const result = activationFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      const mismatch = issues.find((i) => i.path.includes('confirmPassword'));
      expect(mismatch).toBeDefined();
      expect(mismatch?.message).toBe('Las contraseñas no coinciden.');
    }
  });

  it('reports every violated rule at once for weak password', () => {
    // Demasiado corta (< 10), sin letras y sin números
    const data = {
      password: '---',
      confirmPassword: '---',
    };

    const result = activationFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('La contraseña debe tener al menos 10 caracteres');
      expect(messages).toContain('La contraseña debe incluir al menos una letra');
      expect(messages).toContain('La contraseña debe incluir al menos un número');
    }
  });

  it('rejects a password over 128 characters', () => {
    const longPassword = 'A'.repeat(125) + '12345';
    const data = {
      password: longPassword,
      confirmPassword: longPassword,
    };

    const result = activationFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('La contraseña no puede exceder 128 caracteres');
    }
  });

  it('requires confirmPassword', () => {
    const data = {
      password: 'StrongPassword123*',
      confirmPassword: '',
    };

    const result = activationFormSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.some((i) => i.path.includes('confirmPassword'))).toBe(true);
    }
  });
});
