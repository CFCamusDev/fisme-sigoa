import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from '../audit/request-context.js';

const VALID_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Middleware para inicializar el contexto de la petición HTTP con AsyncLocalStorage (RS-041).
 * Genera o sanitiza el identificador de solicitud (X-Request-Id) y captura la IP del cliente.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.headers['x-request-id'];
  const rawId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  const requestId = rawId && VALID_REQUEST_ID_REGEX.test(rawId) ? rawId : crypto.randomUUID();

  const ip = req.ip || req.socket.remoteAddress || undefined;

  res.setHeader('X-Request-Id', requestId);

  runWithRequestContext({ ip, requestId }, () => {
    next();
  }).catch(next);
}
