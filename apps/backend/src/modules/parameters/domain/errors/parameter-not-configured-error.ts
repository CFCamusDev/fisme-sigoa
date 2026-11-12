import { AppError } from '../../../../shared/errors/app-error.js';

/** Falta el valor por defecto de un parámetro: indica un seed que no se ejecutó. */
export class ParameterNotConfiguredError extends AppError {
  constructor(key: string) {
    super(`El parámetro ${key} no tiene un valor configurado.`, 'INTERNAL_ERROR', 500);
  }
}
