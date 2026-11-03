import { describe, expect, it } from 'vitest';
import {
  loginRequestSchema,
  loginResponseSchema,
  refreshResponseSchema,
  type LoginRequest,
  type LoginResponse,
} from './auth.js';

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
});
