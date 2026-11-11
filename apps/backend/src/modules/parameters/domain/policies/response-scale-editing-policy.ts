import type { ResponseScale } from '../entities/response-scale.js';
import { ResponseScaleInUseError } from '../errors/response-scale-in-use-error.js';

/**
 * Una escala usada en una encuesta publicada no se modifica; se duplica (RF-012, CA3).
 * `inUse` lo resuelve el caso de uso con `ScaleUsageReader` dentro de la transacción.
 */
export function assertScaleEditable(input: { scale: ResponseScale; inUse: boolean }): void {
  if (input.inUse) {
    throw new ResponseScaleInUseError();
  }
}
