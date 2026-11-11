import { ValidationError } from '../../../../shared/errors/app-error.js';

/** Variables ADMIN_* ausentes o inválidas cuando aún no existe ningún administrador. */
export class BootstrapAdminConfigError extends ValidationError {
  public readonly variables: readonly string[];

  constructor(issues: readonly { variable: string; message: string }[]) {
    const detail = issues.map((issue) => `${issue.variable} ${issue.message}`).join('; ');
    super(
      `No se puede crear el primer administrador. Corrige estas variables de entorno: ${detail}.`,
    );
    this.variables = issues.map((issue) => issue.variable);
  }
}
