import { ConflictError } from '../../../../shared/errors/app-error.js';

export class AnnexDownloadInProgressError extends ConflictError {
  constructor(message = 'Ya estás generando un anexo. Espera a que termine.') {
    super(message);
  }
}
