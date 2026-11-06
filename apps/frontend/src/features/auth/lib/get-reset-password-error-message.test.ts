import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { getResetPasswordErrorMessage } from './get-reset-password-error-message';

describe('getResetPasswordErrorMessage (HU-005, T-005-11, RNF-037)', () => {
  it('maps RATE_LIMITED to wait message', () => {
    const error = new ApiError({
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded',
      status: 429,
    });
    expect(getResetPasswordErrorMessage(error)).toBe(
      'Hiciste demasiados intentos. Espera un minuto e inténtalo de nuevo.',
    );
  });

  it('maps unknown errors to generic reset error message', () => {
    const internalError = new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Server error',
      status: 500,
    });
    expect(getResetPasswordErrorMessage(internalError)).toBe(
      'No pudimos restablecer tu contraseña. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );

    expect(getResetPasswordErrorMessage(new Error('Network failure'))).toBe(
      'No pudimos restablecer tu contraseña. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );

    expect(getResetPasswordErrorMessage(null)).toBe(
      'No pudimos restablecer tu contraseña. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );
  });
});
