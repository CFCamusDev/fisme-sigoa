import * as argon2 from 'argon2';
import type { PasswordHasher } from '../../domain/ports/password-hasher.js';

/**
 * Hash ficticio precalculado con parámetros OWASP de argon2id (m=19 MiB, t=2, p=1).
 * Se utiliza para ejecutar la verificación completa cuando el correo no existe,
 * evitando discrepancias de tiempo de respuesta (timing attack / enumeración de cuentas).
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$eWh9f6Zir5P0bVNWs3MvhA$Xz+O6IBxH5B4tYYVYeBXixOHfv8olmxZJJaZMD5Ifsk';

export class Argon2PasswordHasher implements PasswordHasher {
  // Parámetros recomendados por OWASP para Argon2id (m=19 MiB, t=2, p=1)
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB en KiB
    timeCost: 2,
    parallelism: 1,
  };

  async hash(plainPassword: string): Promise<string> {
    return await argon2.hash(plainPassword, this.options);
  }

  async verify(plainPassword: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainPassword);
    } catch {
      return false;
    }
  }

  async verifyDummy(plainPassword: string): Promise<boolean> {
    try {
      await argon2.verify(DUMMY_HASH, plainPassword);
    } catch {
      // Fallback seguro ante cualquier formato anómalo
    }
    return false;
  }
}
