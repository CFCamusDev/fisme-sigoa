import type { GraduateAttribute } from '../entities/graduate-attribute.js';

export interface GraduateAttributeRepository {
  /**
   * Exige transacción activa (evita versiones con copia a medias). Inserta todos los atributos
   * de la versión o ninguno.
   */
  insertMany(versionId: string, items: readonly GraduateAttribute[]): Promise<void>;
}
