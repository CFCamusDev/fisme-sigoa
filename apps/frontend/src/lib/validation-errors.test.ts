import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError } from './api-error';
import { getFieldErrors, readableApiMessage } from './validation-errors';

describe('validation-errors (HU-081, T-081-30)', () => {
  it('getFieldErrors reads ApiError details and ZodError issues', () => {
    const schema = z.object({
      names: z.string().min(1, 'El nombre es obligatorio'),
      members: z.array(z.object({ degree: z.string().min(1, 'El grado es obligatorio') })),
    });
    const parsed = schema.safeParse({ names: '', members: [{ degree: '' }] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(getFieldErrors(parsed.error)).toEqual({
        names: 'El nombre es obligatorio',
        'members.0.degree': 'El grado es obligatorio',
      });
    }

    const apiError = new ApiError({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Datos inválidos',
      details: [
        { path: 'body.periodStart', message: 'Ingresa la fecha de inicio.' },
        { path: 'members.0.userEmail', message: 'Usuario no encontrado.' },
      ],
    });
    expect(getFieldErrors(apiError)).toEqual({
      periodStart: 'Ingresa la fecha de inicio.',
      'members.0.userEmail': 'Usuario no encontrado.',
    });
  });

  it('readableApiMessage hides raw JSON and falls back cleanly', () => {
    const rawZodJson = JSON.stringify([
      {
        code: 'invalid_string',
        path: ['dni'],
        message: 'El DNI debe contener exactamente 8 dígitos numéricos',
      },
    ]);

    const errWithoutDetails = new ApiError({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: rawZodJson,
    });
    const out1 = readableApiMessage(errWithoutDetails, 'Los datos ingresados no son válidos.');
    expect(out1).toBe('Los datos ingresados no son válidos.');
    expect(out1).not.toContain('invalid_string');
    expect(out1.trim().startsWith('[')).toBe(false);

    const errWithDetails = new ApiError({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: rawZodJson,
      details: [{ path: 'dni', message: 'El DNI debe tener 8 dígitos.' }],
    });
    expect(readableApiMessage(errWithDetails)).toBe('El DNI debe tener 8 dígitos.');

    expect(
      readableApiMessage(
        new ApiError({ code: 'CONFLICT', status: 409, message: 'Correo duplicado.' }),
      ),
    ).toBe('Correo duplicado.');
  });
});
