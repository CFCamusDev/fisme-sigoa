import type { ResponseScale } from '../entities/response-scale.js';

export interface ResponseScaleRepository {
  /**
   * Exige transacción activa: bloquea la fila de la escala (`FOR UPDATE`) y la devuelve con sus
   * niveles, o `null` si no existe. La comprobación «en uso» y el reemplazo de niveles ocurren
   * bajo este bloqueo.
   */
  lockById(id: string): Promise<ResponseScale | null>;
  /** Inserta la cabecera de la escala o actualiza su nombre; los niveles van por `ScaleLevelRepository`. */
  save(scale: ResponseScale): Promise<void>;
}
