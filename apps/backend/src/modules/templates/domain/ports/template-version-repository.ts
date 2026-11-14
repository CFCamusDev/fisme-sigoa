import type { TemplateVersion, TemplateVersionStatus } from '../entities/template-version.js';

/** Todos los métodos exigen transacción activa (UnitOfWork), como `lockForUpdate`. */
export interface TemplateVersionRepository {
  /**
   * Inserta un Borrador. Lanza `TemplateDraftExistsError` si la plantilla ya tiene uno y
   * `TemplateVersionNumberConflictError` si el número ya existe en la plantilla.
   */
  saveDraft(version: TemplateVersion): Promise<void>;
  /**
   * Cambia el contenido solo si la versión sigue en Borrador
   * (`UPDATE … WHERE id AND status = 'DRAFT'`); devuelve `false` si no afectó ninguna fila.
   */
  updateDraftContent(id: string, content: string, actorId: string, now: Date): Promise<boolean>;
  /**
   * Cambia el estado solo si sigue siendo `from` (`UPDATE … WHERE id AND status = from`);
   * devuelve `false` si no afectó ninguna fila, de modo que solo una ejecución concurrente gane
   * (AGENTS §4.2, punto 7). Al publicar fija `publishedAt` y `publishedBy`; lanza
   * `TemplatePublishedExistsError` si ya hay otra Publicada.
   */
  transitionStatus(
    id: string,
    from: TemplateVersionStatus,
    to: TemplateVersionStatus,
    actorId: string,
    now: Date,
  ): Promise<boolean>;
}
