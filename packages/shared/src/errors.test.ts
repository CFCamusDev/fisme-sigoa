import { describe, expect, it } from 'vitest';
import { apiErrorResponseSchema, errorCodeSchema } from './errors.js';

describe('errors', () => {
  describe('errorCodeSchema', () => {
    it('contains all required business and operational error codes including INVALID_PASSWORD_RESET_TOKEN', () => {
      const expectedCodes = [
        'VALIDATION_ERROR',
        'NOT_FOUND',
        'FORBIDDEN',
        'CONFLICT',
        'INTERNAL_ERROR',
        'RATE_LIMITED',
        'UNAUTHORIZED',
        'ACCOUNT_LOCKED',
        'ACCOUNT_INACTIVE',
        'ACCOUNT_PENDING_ACTIVATION',
        'INVALID_ACTIVATION_TOKEN',
        'INVALID_PASSWORD_RESET_TOKEN',
      ];

      expect(errorCodeSchema.options).toEqual(expectedCodes);
    });

    it('validates valid error codes and rejects unknown ones', () => {
      expect(errorCodeSchema.safeParse('INVALID_PASSWORD_RESET_TOKEN').success).toBe(true);
      expect(errorCodeSchema.safeParse('UNKNOWN_ERROR_CODE').success).toBe(false);
    });
  });

  describe('apiErrorResponseSchema', () => {
    it('accepts valid ApiErrorResponse payloads with INVALID_PASSWORD_RESET_TOKEN', () => {
      const payload = {
        error: {
          code: 'INVALID_PASSWORD_RESET_TOKEN',
          message: 'El enlace no es válido o venció.',
          requestId: 'req_123',
        },
      };

      const result = apiErrorResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
