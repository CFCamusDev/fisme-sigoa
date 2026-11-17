import type { Request } from 'express';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';

export function resolveRequestActor(req: Request): { actorId: string; ip: string } {
  const context = getRequestContext();
  const actorId = context?.actor ?? (req as unknown as { user?: { id?: string } }).user?.id;
  if (!actorId) {
    throw new UnauthorizedError('No autenticado');
  }
  const ip = context?.ip ?? (req.ip || req.socket?.remoteAddress) ?? '127.0.0.1';
  return { actorId, ip };
}
