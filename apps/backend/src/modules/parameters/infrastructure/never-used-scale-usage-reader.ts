import type { ScaleUsageReader } from '../domain/ports/scale-usage-reader.js';

/**
 * Adaptador provisional (D4 de HU-012): aún no existen encuestas, así que ninguna escala está en
 * uso. La HU de encuestas lo reemplaza por una consulta real de preguntas de encuestas publicadas.
 */
export class NeverUsedScaleUsageReader implements ScaleUsageReader {
  async isInUse(_scaleId: string): Promise<boolean> {
    return false;
  }
}
