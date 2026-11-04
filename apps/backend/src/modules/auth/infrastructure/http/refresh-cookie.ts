import type { Request, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'sigoa_refresh_token';
export const REFRESH_COOKIE_PATH = '/auth';

export interface RefreshCookieSettings {
  sameSite: 'strict' | 'lax' | 'none';
  isProduction: boolean;
}

/**
 * Fija la cookie HttpOnly con el refresh token.
 * Cumple con directiva de seguridad anti-XSS impidiendo acceso desde JavaScript en el navegador.
 */
export function setRefreshCookie(
  res: Response,
  token: string,
  expiresAt: Date,
  settings: RefreshCookieSettings,
): void {
  const maxAgeMs = Math.max(0, expiresAt.getTime() - Date.now());

  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeMs,
    sameSite: settings.sameSite,
    secure: settings.isProduction,
  });
}

/**
 * Borra la cookie HttpOnly del refresh token.
 */
export function clearRefreshCookie(res: Response, settings: RefreshCookieSettings): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    sameSite: settings.sameSite,
    secure: settings.isProduction,
  });
}

/**
 * Extrae el token de actualización desde la cabecera Cookie sin requerir `cookie-parser`.
 */
export function readRefreshCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawKey, ...rawValueParts] = cookie.trim().split('=');
    if (rawKey === REFRESH_COOKIE_NAME) {
      const rawValue = rawValueParts.join('=');
      if (!rawValue) {
        return null;
      }
      try {
        const decoded = decodeURIComponent(rawValue);
        return decoded.trim() || null;
      } catch {
        return rawValue.trim() || null;
      }
    }
  }

  return null;
}
