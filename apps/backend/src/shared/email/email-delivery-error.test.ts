import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/app-error.js';
import { EmailDeliveryError } from './email-delivery-error.js';

describe('EmailDeliveryError', () => {
  it('extends AppError with default Spanish message, INTERNAL_ERROR code and 500 status', () => {
    const error = new EmailDeliveryError();

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('EmailDeliveryError');
    expect(error.message).toBe('Error al enviar el correo electrónico');
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.httpStatus).toBe(500);
    expect(error.cause).toBeUndefined();
  });

  it('preserves custom message and optional cause without leaking in message', () => {
    const rootCause = new Error('Provider connection timeout');
    const error = new EmailDeliveryError('Fallo al conectar con el servicio de correo', rootCause);

    expect(error.message).toBe('Fallo al conectar con el servicio de correo');
    expect(error.cause).toBe(rootCause);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.httpStatus).toBe(500);
  });
});
