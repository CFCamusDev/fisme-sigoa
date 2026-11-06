import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, type ValidationDetail } from '@sigoa/shared';
import { WeakPasswordError } from '../errors/weak-password-error.js';

export class PasswordPolicy {
  public static evaluate(plain: string): ValidationDetail[] {
    const details: ValidationDetail[] = [];

    if (plain.length < PASSWORD_MIN_LENGTH) {
      details.push({
        path: 'password',
        message: 'La contraseña debe tener al menos 10 caracteres',
      });
    }

    if (plain.length > PASSWORD_MAX_LENGTH) {
      details.push({
        path: 'password',
        message: 'La contraseña no puede exceder 128 caracteres',
      });
    }

    if (!/\p{L}/u.test(plain)) {
      details.push({
        path: 'password',
        message: 'La contraseña debe incluir al menos una letra',
      });
    }

    if (!/[0-9]/.test(plain)) {
      details.push({
        path: 'password',
        message: 'La contraseña debe incluir al menos un número',
      });
    }

    return details;
  }

  public static assert(plain: string): void {
    const details = this.evaluate(plain);
    if (details.length > 0) {
      throw new WeakPasswordError(details);
    }
  }
}
