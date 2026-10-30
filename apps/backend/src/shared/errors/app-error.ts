import type { ErrorCode, ValidationDetail } from '@sigoa/shared';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: ValidationDetail[];
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    code: ErrorCode,
    httpStatus: number,
    details?: ValidationDetail[],
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ValidationError extends AppError {
  constructor(
    message = 'La solicitud contiene errores de validación',
    details?: ValidationDetail[],
  ) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Credenciales inválidas') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tiene permisos para realizar esta acción') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'El recurso presenta un conflicto con el estado actual') {
    super(message, 'CONFLICT', 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message = 'Ha excedido el límite de solicitudes permitidas. Intente nuevamente más tarde.',
    retryAfterSeconds?: number,
  ) {
    super(message, 'RATE_LIMITED', 429, undefined, retryAfterSeconds);
  }
}
