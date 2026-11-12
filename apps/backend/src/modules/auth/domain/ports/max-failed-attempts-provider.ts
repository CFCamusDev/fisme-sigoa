/** Límite de intentos fallidos de inicio de sesión vigente hoy (RF-001, RF-011 LOGIN_INTENTOS). */
export interface MaxFailedAttemptsProvider {
  getMaxFailedAttempts(): Promise<number>;
}
