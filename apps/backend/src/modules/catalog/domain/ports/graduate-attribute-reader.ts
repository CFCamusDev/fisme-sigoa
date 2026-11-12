import type { GraduateAttribute } from '../entities/graduate-attribute.js';

export interface GraduateAttributeReader {
  /** Atributos de la versión, ordenados por `order`. */
  listByVersion(versionId: string): Promise<GraduateAttribute[]>;
}
