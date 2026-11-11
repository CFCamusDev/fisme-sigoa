import type { ScaleLevel } from '../entities/response-scale.js';

export interface ScaleLevelRepository {
  /**
   * Exige transacción activa: borra los niveles de la escala y inserta los nuevos, de modo que
   * nunca queda una escala con niveles a medias.
   */
  replaceLevels(scaleId: string, levels: readonly ScaleLevel[]): Promise<void>;
}
