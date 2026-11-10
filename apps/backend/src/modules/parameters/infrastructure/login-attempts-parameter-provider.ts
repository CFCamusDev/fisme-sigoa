import type { ParameterResolver } from '../domain/services/parameter-resolver.js';

export interface LoginAttemptsParameterProviderDependencies {
  readonly resolver: Pick<ParameterResolver, 'resolveAt'>;
  /** Valor de respaldo (configuración) si el parámetro no se puede resolver. */
  readonly fallbackMaxFailedAttempts: number;
  readonly clock?: () => Date;
  readonly logger?: { error: (obj: unknown, message: string) => void };
}

/**
 * Entrega a `auth` el límite de intentos fallidos vigente hoy (parámetro LOGIN_INTENTOS, RF-011).
 * Implementa estructuralmente el puerto `MaxFailedAttemptsProvider` de `auth`, sin importarlo
 * (los módulos no se importan entre sí, AGENTS §4.1). Si el parámetro no se puede resolver,
 * el inicio de sesión no se interrumpe: se usa el valor de configuración y se registra el error.
 */
export class LoginAttemptsParameterProvider {
  private readonly clock: () => Date;

  constructor(private readonly deps: LoginAttemptsParameterProviderDependencies) {
    this.clock = deps.clock ?? (() => new Date());
  }

  async getMaxFailedAttempts(): Promise<number> {
    try {
      const today = this.clock().toISOString().slice(0, 10);
      const resolved = await this.deps.resolver.resolveAt(today);
      return resolved.LOGIN_INTENTOS;
    } catch (error) {
      this.deps.logger?.error(
        { err: error },
        'No se pudo resolver LOGIN_INTENTOS; se usa el valor de configuración',
      );
      return this.deps.fallbackMaxFailedAttempts;
    }
  }
}
