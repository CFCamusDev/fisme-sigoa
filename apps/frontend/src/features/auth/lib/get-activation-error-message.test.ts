import { describe, expect, it } from 'vitest';
import { getActivationErrorMessage } from './get-activation-error-message';

describe('getActivationErrorMessage (HU-004, T-004-10)', () => {
  it('returns rate limit message on RATE_LIMITED', () => {
    const error = { code: 'RATE_LIMITED' };
    expect(getActivationErrorMessage(error)).toBe(
      'Hiciste demasiados intentos. Espera un minuto e inténtalo de nuevo.',
    );
  });

  it('returns generic error message on NETWORK_ERROR', () => {
    const error = { code: 'NETWORK_ERROR' };
    expect(getActivationErrorMessage(error)).toBe(
      'No pudimos activar tu cuenta. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );
  });

  it('returns generic error message on unknown error code', () => {
    const error = { code: 'INTERNAL_ERROR' };
    expect(getActivationErrorMessage(error)).toBe(
      'No pudimos activar tu cuenta. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );
  });

  it('returns generic error message when error is undefined or empty', () => {
    expect(getActivationErrorMessage(undefined)).toBe(
      'No pudimos activar tu cuenta. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );
    expect(getActivationErrorMessage(null)).toBe(
      'No pudimos activar tu cuenta. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );
  });
});
