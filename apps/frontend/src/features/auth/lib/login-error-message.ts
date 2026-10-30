import type { ApiError } from '@/lib/api-error';

export function getLoginErrorMessage(error: unknown): string {
  const apiError = error as Partial<ApiError> | undefined;
  const code = apiError?.code;

  switch (code) {
    case 'UNAUTHORIZED':
      return 'Correo o contraseña incorrectos.';

    case 'ACCOUNT_LOCKED': {
      const retryAfterSeconds = apiError?.retryAfterSeconds;
      const minutes =
        typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
          ? Math.ceil(retryAfterSeconds / 60)
          : 15;
      return `Tu cuenta está bloqueada temporalmente por exceso de intentos fallidos. Inténtalo de nuevo en ${minutes} minuto(s).`;
    }

    case 'ACCOUNT_INACTIVE':
      return 'Tu cuenta está inactiva. Comunícate con el administrador del sistema.';

    case 'ACCOUNT_PENDING_ACTIVATION':
      return 'Tu cuenta aún no está activada. Usa el enlace de activación enviado a tu correo o solicita uno al administrador.';

    case 'RATE_LIMITED':
      return 'Hiciste demasiados intentos. Espera un minuto e inténtalo de nuevo.';

    case 'NETWORK_ERROR':
    default:
      return 'No pudimos iniciar tu sesión. Inténtalo de nuevo; si persiste, avisa al administrador.';
  }
}
