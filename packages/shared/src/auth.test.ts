import { describe, expect, it } from 'vitest';
import {
  loginRequestSchema,
  loginResponseSchema,
  refreshResponseSchema,
  passwordSchema,
  activateAccountRequestSchema,
  activateAccountResponseSchema,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  ACTIVATION_TOKEN_MAX_LENGTH,
  type LoginRequest,
  type LoginResponse,
  type ActivateAccountRequest,
  type ActivateAccountResponse,
} from './auth.js';
import { errorCodeSchema } from './errors.js';

describe('Auth Schemas (T-001-11, T-002-05, RS-016, RNF-003, RNF-004, RNF-008)', () => {
  describe('loginRequestSchema', () => {
    it('normalizes and validates a valid login request trimming and lowercasing the email', () => {
      const parsed: LoginRequest = loginRequestSchema.parse({
        email: '  Usuario.Prueba@UNTRM.EDU.PE  ',
        password: 'Password123!',
      });

      expect(parsed.email).toBe('usuario.prueba@untrm.edu.pe');
      expect(parsed.password).toBe('Password123!');
    });

    it('rejects an empty email or invalid email format', () => {
      expect(() =>
        loginRequestSchema.parse({
          email: '   ',
          password: 'Password123!',
        }),
      ).toThrow();

      expect(() =>
        loginRequestSchema.parse({
          email: 'not-an-email',
          password: 'Password123!',
        }),
      ).toThrow();
    });

    it('rejects an empty password', () => {
      expect(() =>
        loginRequestSchema.parse({
          email: 'test@untrm.edu.pe',
          password: '',
        }),
      ).toThrow();
    });

    it('rejects an oversized password exceeding 128 characters to protect against hash DoS', () => {
      const longPassword = 'a'.repeat(129);
      expect(() =>
        loginRequestSchema.parse({
          email: 'test@untrm.edu.pe',
          password: longPassword,
        }),
      ).toThrow();
    });
  });

  describe('loginResponseSchema', () => {
    const validResponse: LoginResponse = {
      accessToken: 'header.payload.signature',
      accessTokenExpiresAt: '2026-10-30T15:15:00.000Z',
      refreshTokenExpiresAt: '2026-11-06T15:00:00.000Z',
      user: {
        id: 'usr_abc_123',
        names: 'Juan Carlos',
        firstSurname: 'Pérez',
        secondSurname: 'Gómez',
        email: 'juan.perez@untrm.edu.pe',
      },
    };

    it('accepts a valid login response with all expected fields without exposing refreshToken', () => {
      const parsed = loginResponseSchema.parse(validResponse);
      expect(parsed).toEqual(validResponse);
    });

    it('accepts a login response when secondSurname is null', () => {
      const parsed = loginResponseSchema.parse({
        ...validResponse,
        user: {
          ...validResponse.user,
          secondSurname: null,
        },
      });
      expect(parsed.user.secondSurname).toBeNull();
    });

    it('rejects refreshToken in the body (now delivered strictly via HttpOnly cookie)', () => {
      expect(() =>
        loginResponseSchema.parse({
          ...validResponse,
          refreshToken: 'forbidden-in-body',
        }),
      ).toThrow();
    });

    it('rejects extra sensitive fields in user such as passwordHash or dni (Ley 29733)', () => {
      const payloadWithSensitiveData = {
        ...validResponse,
        user: {
          ...validResponse.user,
          passwordHash: '$argon2id$v=19$m=65536...',
          dni: '12345678',
        },
      };

      expect(() => loginResponseSchema.parse(payloadWithSensitiveData)).toThrow();
    });
  });

  describe('refreshResponseSchema (T-002-05, RF-002)', () => {
    it('refresh response has the same shape as the login response', () => {
      expect(refreshResponseSchema).toBe(loginResponseSchema);
      const payload = {
        accessToken: 'access-jwt-token',
        accessTokenExpiresAt: '2026-10-30T15:15:00.000Z',
        refreshTokenExpiresAt: '2026-11-06T15:00:00.000Z',
        user: {
          id: 'usr_1',
          names: 'Carlos',
          firstSurname: 'Gómez',
          secondSurname: null,
          email: 'carlos.gomez@untrm.edu.pe',
        },
      };
      const parsed = refreshResponseSchema.parse(payload);
      expect(parsed).toEqual(payload);
    });
  });

  describe('passwordSchema (T-004-06, RF-004, RNF-003, CA3)', () => {
    it('accepts a password that meets the policy', () => {
      const valid = 'MiClaveSegura123!';
      expect(passwordSchema.parse(valid)).toBe(valid);
      expect(PASSWORD_MIN_LENGTH).toBe(10);
      expect(PASSWORD_MAX_LENGTH).toBe(128);
    });

    it('rejects a password shorter than 10 characters with its detail', () => {
      const result = passwordSchema.safeParse('Corto1');
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain('La contraseña debe tener al menos 10 caracteres');
      }
    });

    it('rejects a password without numbers', () => {
      const result = passwordSchema.safeParse('SoloLetrasAqui');
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain('La contraseña debe incluir al menos un número');
      }
    });

    it('rejects a password without letters', () => {
      const result = passwordSchema.safeParse('1234567890123');
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain('La contraseña debe incluir al menos una letra');
      }
    });

    it('rejects a password over 128 characters', () => {
      const longPassword = 'A1' + 'a'.repeat(127);
      const result = passwordSchema.safeParse(longPassword);
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain('La contraseña no puede exceder 128 caracteres');
      }
    });

    it('reports every violated rule at once', () => {
      const result = passwordSchema.safeParse('123');
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain('La contraseña debe tener al menos 10 caracteres');
        expect(messages).toContain('La contraseña debe incluir al menos una letra');
      }
    });
  });

  describe('activateAccountRequestSchema and activateAccountResponseSchema (T-004-06, RF-004, RNF-008)', () => {
    it('accepts a valid activation request', () => {
      const validPayload: ActivateAccountRequest = {
        token: 'a'.repeat(43),
        password: 'PasswordSegura2026',
      };
      const parsed = activateAccountRequestSchema.parse(validPayload);
      expect(parsed).toEqual(validPayload);
      expect(ACTIVATION_TOKEN_MAX_LENGTH).toBe(128);
    });

    it('rejects unknown fields in the activation request (strict)', () => {
      const payloadWithUnknown = {
        token: 'a'.repeat(43),
        password: 'PasswordSegura2026',
        extraField: 'not-allowed',
      };
      expect(() => activateAccountRequestSchema.parse(payloadWithUnknown)).toThrow();
    });

    it('rejects an empty or oversized token', () => {
      expect(() =>
        activateAccountRequestSchema.parse({
          token: '',
          password: 'PasswordSegura2026',
        }),
      ).toThrow();

      expect(() =>
        activateAccountRequestSchema.parse({
          token: 'a'.repeat(129),
          password: 'PasswordSegura2026',
        }),
      ).toThrow();
    });

    it('accepts the activation response only with status ACTIVE', () => {
      const validResponse: ActivateAccountResponse = {
        status: 'ACTIVE',
      };
      expect(activateAccountResponseSchema.parse(validResponse)).toEqual(validResponse);

      expect(() =>
        activateAccountResponseSchema.parse({
          status: 'INACTIVE',
        }),
      ).toThrow();

      expect(() =>
        activateAccountResponseSchema.parse({
          status: 'ACTIVE',
          extra: true,
        }),
      ).toThrow();
    });

    it('errorCodeSchema includes INVALID_ACTIVATION_TOKEN', () => {
      expect(errorCodeSchema.parse('INVALID_ACTIVATION_TOKEN')).toBe('INVALID_ACTIVATION_TOKEN');
    });
  });
});
