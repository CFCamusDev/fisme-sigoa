import { describe, expect, it } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
  TooManyRequestsError,
} from './index.js';

describe('typed errors', () => {
  it('TooManyRequestsError maps to RATE_LIMITED and 429', () => {
    const error = new TooManyRequestsError();
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.httpStatus).toBe(429);
    expect(error.message).toContain('excedido el límite');
  });
  it('each typed error maps to its code and http status', () => {
    const notFound = new NotFoundError('Recurso no encontrado');
    expect(notFound).toBeInstanceOf(AppError);
    expect(notFound.code).toBe('NOT_FOUND');
    expect(notFound.httpStatus).toBe(404);
    expect(notFound.message).toBe('Recurso no encontrado');

    const validation = new ValidationError('Datos inválidos', [
      { path: 'email', message: 'Formato incorrecto' },
    ]);
    expect(validation).toBeInstanceOf(AppError);
    expect(validation.code).toBe('VALIDATION_ERROR');
    expect(validation.httpStatus).toBe(400);
    expect(validation.details).toEqual([{ path: 'email', message: 'Formato incorrecto' }]);

    const forbidden = new ForbiddenError('Acceso denegado');
    expect(forbidden).toBeInstanceOf(AppError);
    expect(forbidden.code).toBe('FORBIDDEN');
    expect(forbidden.httpStatus).toBe(403);

    const conflict = new ConflictError('Conflicto con recurso existente');
    expect(conflict).toBeInstanceOf(AppError);
    expect(conflict.code).toBe('CONFLICT');
    expect(conflict.httpStatus).toBe(409);
  });
});
