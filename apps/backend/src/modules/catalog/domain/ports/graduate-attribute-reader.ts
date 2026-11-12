import type { GraduateAttribute } from '../entities/graduate-attribute.js';

export interface GraduateAttributeReader {
  /** Atributos de la versión, ordenados por `order`. */
  listByVersion(versionId: string): Promise<GraduateAttribute[]>;
  /** Cantidad de atributos por versión en una sola consulta; las versiones sin filas valen 0. */
  countByVersionIds(versionIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
