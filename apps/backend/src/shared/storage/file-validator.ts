import { ValidationError } from '../errors/app-error.js';

export interface FileValidationRules {
  readonly allowedMimeTypes: readonly string[];
  readonly maxBytes: number;
}

export interface FileToValidate {
  readonly content: Buffer;
  readonly originalName: string;
  readonly mimeType: string;
}

function hasPdfSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 // F
  );
}

function hasJpegSignature(buffer: Buffer): boolean {
  if (buffer.length < 3) {
    return false;
  }
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function hasPngSignature(buffer: Buffer): boolean {
  if (buffer.length < 8) {
    return false;
  }
  return (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

/**
 * Valida un archivo comprobando tamaño máximo, tipo declarado y firma mágica real (RN-005, RNF-013).
 *
 * Los parámetros de validación son obligatorios y deben provenir de la configuración vigente.
 */
export function validateFile(input: FileToValidate, rules: FileValidationRules): void {
  if (input.content.length === 0) {
    throw new ValidationError('El archivo no puede estar vacío');
  }

  if (input.content.length > rules.maxBytes) {
    throw new ValidationError('El archivo excede el tamaño máximo permitido');
  }

  if (!rules.allowedMimeTypes.includes(input.mimeType)) {
    throw new ValidationError('El tipo de archivo no está permitido');
  }

  if (input.mimeType === 'application/pdf' && !hasPdfSignature(input.content)) {
    throw new ValidationError('El contenido del archivo no coincide con el formato PDF declarado');
  }

  if (input.mimeType === 'image/jpeg' && !hasJpegSignature(input.content)) {
    throw new ValidationError('El contenido del archivo no coincide con el formato JPEG declarado');
  }

  if (input.mimeType === 'image/png' && !hasPngSignature(input.content)) {
    throw new ValidationError('El contenido del archivo no coincide con el formato PNG declarado');
  }
}
