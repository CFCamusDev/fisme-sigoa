import { AppError } from '../../../shared/errors/app-error.js';

export class DomainError extends AppError {
  constructor() {
    super('Domain error');
  }
}
