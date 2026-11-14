import express, { type RequestHandler } from 'express';
import { RESOLUTION_PDF_MAX_BYTES, RESOLUTION_PDF_MIME_TYPE } from '@sigoa/shared';
import { ValidationError } from '../../../../shared/errors/app-error.js';

/**
 * Lee el cuerpo binario `application/pdf` de la aprobación (D2). Se monta **después** de
 * autenticar y autorizar (D1): un usuario sin permiso no hace que el servidor almacene el archivo.
 * El error de tamaño de `body-parser` se traduce a 400 (de lo contrario saldría como 500).
 */
export function resolutionPdfBody(): RequestHandler {
  const parser = express.raw({ type: RESOLUTION_PDF_MIME_TYPE, limit: RESOLUTION_PDF_MAX_BYTES });
  return (req, res, next) => {
    parser(req, res, (error?: unknown) => {
      if (error && (error as { type?: string }).type === 'entity.too.large') {
        next(new ValidationError('El PDF excede el tamaño máximo permitido de 10 MB.'));
        return;
      }
      next(error);
    });
  };
}
