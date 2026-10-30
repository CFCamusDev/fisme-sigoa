import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import type { ApiErrorResponse } from '@sigoa/shared';
import { AppError, NotFoundError } from '../errors/app-error.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.path}`));
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId =
    typeof req.id === 'string' ? req.id : (req.headers['x-request-id'] as string | undefined);

  if (err instanceof AppError) {
    if (err.retryAfterSeconds !== undefined && err.retryAfterSeconds >= 0) {
      res.setHeader('Retry-After', String(Math.ceil(err.retryAfterSeconds)));
    }

    const body: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && err.details.length > 0 ? { details: err.details } : {}),
        ...(requestId ? { requestId } : {}),
        ...(err.retryAfterSeconds !== undefined && err.retryAfterSeconds >= 0
          ? { retryAfterSeconds: Math.ceil(err.retryAfterSeconds) }
          : {}),
      },
    };
    res.status(err.httpStatus).json(body);
    return;
  }

  // SyntaxError por JSON mal formado en el cuerpo de la petición
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status: unknown }).status === 400 &&
    'body' in err
  ) {
    const body: ApiErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'El cuerpo de la solicitud no es un JSON válido.',
        ...(requestId ? { requestId } : {}),
      },
    };
    res.status(400).json(body);
    return;
  }

  // Error inesperado: registrar traza en logger y responder genérico 500
  if (req.log) {
    req.log.error(err, 'Error no controlado procesando la solicitud');
  }

  const body: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ha ocurrido un error inesperado en el servidor.',
      ...(requestId ? { requestId } : {}),
    },
  };
  res.status(500).json(body);
};
