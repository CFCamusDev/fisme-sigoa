import type { RequestHandler } from 'express';
import { InvalidImportFileError } from '../../domain/errors/invalid-import-file-error.js';

function hasXlsxSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

/**
 * Valida que el cuerpo binario leído por `express.raw` sea un Buffer no vacío
 * con firma de archivo `.xlsx` (D4).
 */
export const requireExcelBody: RequestHandler = (req, _res, next) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    next(new InvalidImportFileError('Envía el archivo .xlsx como cuerpo de la solicitud.'));
    return;
  }
  if (!hasXlsxSignature(req.body)) {
    next(new InvalidImportFileError());
    return;
  }
  next();
};
