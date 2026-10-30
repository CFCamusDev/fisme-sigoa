import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { getLoginErrorMessage } from './login-error-message';

describe('getLoginErrorMessage', () => {
  it('returns generic message for UNAUTHORIZED without revealing which part failed', () => {
    const error = new ApiError({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    expect(getLoginErrorMessage(error)).toBe('Correo o contraseña incorrectos.');
  });

  it('returns lockout message with calculated waiting minutes for ACCOUNT_LOCKED', () => {
    const error = new ApiError({
      code: 'ACCOUNT_LOCKED',
      message: 'Locked',
      retryAfterSeconds: 900,
    });
    expect(getLoginErrorMessage(error)).toBe(
      'Tu cuenta está bloqueada temporalmente por exceso de intentos fallidos. Inténtalo de nuevo en 15 minuto(s).',
    );

    const errorCeil = new ApiError({
      code: 'ACCOUNT_LOCKED',
      message: 'Locked',
      retryAfterSeconds: 61,
    });
    expect(getLoginErrorMessage(errorCeil)).toBe(
      'Tu cuenta está bloqueada temporalmente por exceso de intentos fallidos. Inténtalo de nuevo en 2 minuto(s).',
    );
  });

  it('returns default 15 minutes when retryAfterSeconds is missing for ACCOUNT_LOCKED', () => {
    const error = new ApiError({ code: 'ACCOUNT_LOCKED', message: 'Locked' });
    expect(getLoginErrorMessage(error)).toBe(
      'Tu cuenta está bloqueada temporalmente por exceso de intentos fallidos. Inténtalo de nuevo en 15 minuto(s).',
    );
  });

  it('returns appropriate message for ACCOUNT_INACTIVE', () => {
    const error = new ApiError({ code: 'ACCOUNT_INACTIVE', message: 'Inactive' });
    expect(getLoginErrorMessage(error)).toBe(
      'Tu cuenta está inactiva. Comunícate con el administrador del sistema.',
    );
  });

  it('returns appropriate message for ACCOUNT_PENDING_ACTIVATION', () => {
    const error = new ApiError({ code: 'ACCOUNT_PENDING_ACTIVATION', message: 'Pending' });
    expect(getLoginErrorMessage(error)).toBe(
      'Tu cuenta aún no está activada. Usa el enlace de activación enviado a tu correo o solicita uno al administrador.',
    );
  });

  it('returns rate limit message for RATE_LIMITED', () => {
    const error = new ApiError({ code: 'RATE_LIMITED', message: 'Rate limited' });
    expect(getLoginErrorMessage(error)).toBe(
      'Hiciste demasiados intentos. Espera un minuto e inténtalo de nuevo.',
    );
  });

  it('returns safe fallback without leaking details for network or unexpected error', () => {
    const networkError = new ApiError({ code: 'NETWORK_ERROR', message: 'Net error' });
    expect(getLoginErrorMessage(networkError)).toBe(
      'No pudimos iniciar tu sesión. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );

    const genericError = new Error('Database password leak');
    expect(getLoginErrorMessage(genericError)).toBe(
      'No pudimos iniciar tu sesión. Inténtalo de nuevo; si persiste, avisa al administrador.',
    );
  });
});
