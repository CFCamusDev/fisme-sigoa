import type { RequestHandler } from 'express';
import { ForbiddenError } from '../../../../shared/errors/app-error.js';

/**
 * Middleware de seguridad anti-CSRF para endpoints basados en cookies (login, refresh, logout).
 * Verifica que si la solicitud incluye un encabezado `Origin`, este pertenezca explícitamente a la lista
 * de orígenes permitidos (`CORS_ORIGIN`). Si no incluye `Origin` (p. ej. herramientas de prueba o llamadas directas),
 * permite el paso.
 */
export function createRequireAllowedOrigin(allowedOrigins: string[]): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (!origin) {
      next();
      return;
    }

    if (!allowedOrigins.includes(origin)) {
      next(new ForbiddenError('Origen de la solicitud no autorizado'));
      return;
    }

    next();
  };
}
