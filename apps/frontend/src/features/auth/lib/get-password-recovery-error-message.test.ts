import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { getPasswordRecoveryErrorMessage } from './get-password-recovery-error-message';

describe('getPasswordRecoveryErrorMessage (HU-005, T-005-10, RNF-037)', () => {
  it('maps RATE_LIMITED to wait message', () => {
    const error = new ApiError({
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded',
      status: 429,
    });
    expect(getPasswordRecoveryErrorMessage(error)).toBe(
      'Hiciste demasiados intentos. Espera un minuto e inténtalo de nuevo.',
    );
  });

  it('maps unknown errors to generic recovery error message', () => {
    const networkError = new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Server error',
      status: 500,
    });
    expect(getPasswordRecoveryErrorMessage(networkError)).toBe(
      'No pudimos procesar tu solicitud. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );

    expect(getPasswordRecoveryErrorMessage(new Error('Unknown failure'))).toBe(
      'No pudimos procesar tu solicitud. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );

    expect(getPasswordRecoveryErrorMessage(null)).toBe(
      'No pudimos procesar tu solicitud. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );
  });
});
