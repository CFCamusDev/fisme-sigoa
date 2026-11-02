import type { Request } from 'express';

/**
 * Resuelve la dirección IP del cliente a partir de la petición Express.
 * Utiliza `req.ip` para respetar la configuración de proxies de confianza (`trust proxy`),
 * evitando la vulnerabilidad de suplantación de IP (IP spoofing) al leer directamente `X-Forwarded-For`.
 */
export function resolveClientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? '';
}
