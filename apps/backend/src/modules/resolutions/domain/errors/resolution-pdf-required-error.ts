import { ValidationError } from '../../../../shared/errors/app-error.js';

export class ResolutionPdfRequiredError extends ValidationError {
  constructor(message = 'Para aprobar la resolución debes adjuntar el PDF firmado.') {
    super(message);
  }
}
