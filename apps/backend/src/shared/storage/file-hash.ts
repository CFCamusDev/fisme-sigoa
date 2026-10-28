import { createHash } from 'node:crypto';

/**
 * Calcula el hash SHA-256 en formato hexadecimal para un buffer de archivo (RS-072, RNF-013).
 */
export function computeSha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
