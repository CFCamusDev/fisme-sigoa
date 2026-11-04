const STORAGE_KEY = 'sigoa.session-hint';

/**
 * Guarda en localStorage únicamente la fecha límite de expiración del refresh token.
 * No guarda tokens ni credenciales.
 */
export function setSessionHint(expiresAt: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, expiresAt);
  } catch {
    // Modo privado o storage deshabilitado; fallo silencioso sin romper la UI.
  }
}

/**
 * Lee la marca de sesión almacenada si existe.
 */
export function readSessionHint(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Elimina la marca de sesión.
 */
export function clearSessionHint(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Modo privado o storage deshabilitado.
  }
}

/**
 * Comprueba si existe un indicio válido de sesión con fecha de expiración futura.
 */
export function hasValidSessionHint(): boolean {
  const value = readSessionHint();
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    clearSessionHint();
    return false;
  }

  if (timestamp <= Date.now()) {
    clearSessionHint();
    return false;
  }

  return true;
}
