import { ValidationError } from '../../../../shared/errors/app-error.js';

export class IncompleteListMemberError extends ValidationError {
  public readonly missingFields: readonly string[];

  constructor(missingFields: readonly string[]) {
    super(
      `Faltan campos obligatorios en el registro del constituyente para este tipo de lista: ${missingFields.join(', ')}.`,
      missingFields.map((field) => ({
        path: field,
        message: `El campo ${field} es obligatorio.`,
      })),
    );
    this.missingFields = [...missingFields];
  }
}
