import type { Resolution, ResolutionPdf } from '../entities/resolution.js';

export interface ResolutionRepository {
  /**
   * Inserta la resolución Registrada. Lanza `DuplicateResolutionNumberError` si el número ya existe
   * para ese tipo o `CatalogVersionResolutionExistsError` si la versión del catálogo ya tiene una
   * resolución de ese tipo.
   */
  save(resolution: Resolution): Promise<void>;
  /**
   * Exige transacción activa: bloquea la fila (`SELECT … FOR UPDATE`) y la devuelve con su estado
   * confirmado, o `null` si no existe (D4, AGENTS §4.2 punto 7).
   */
  lockForApproval(id: string): Promise<Resolution | null>;
  /**
   * Exige transacción activa. Inserta el `StoredFile` del PDF y pasa la resolución a Aprobada solo
   * si sigue Registrada (`UPDATE … WHERE id AND status = 'REGISTERED'`). Devuelve `false` si no
   * afectó ninguna fila (y no deja el archivo insertado), de modo que solo una ejecución gane.
   */
  approve(id: string, pdf: ResolutionPdf, actorId: string, now: Date): Promise<boolean>;
}
