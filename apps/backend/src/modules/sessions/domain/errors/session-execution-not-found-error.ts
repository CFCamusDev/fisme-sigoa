import { NotFoundError } from '../../../../shared/errors/app-error.js';

export class SessionExecutionNotFoundError extends NotFoundError {
  constructor(executionIds: readonly string[]) {
    super(
      executionIds.length === 1
        ? `No se encontró la ejecución de proceso con ID «${executionIds[0]}»`
        : `No se encontraron las ejecuciones de proceso: ${executionIds.join(', ')}`,
    );
  }
}
