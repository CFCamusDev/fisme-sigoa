import type { TemplateVersion } from '../entities/template-version.js';

/** Versión Publicada y Borrador de una plantilla; `null` cuando no existen. */
export interface CurrentTemplateVersions {
  readonly published: TemplateVersion | null;
  readonly draft: TemplateVersion | null;
}

/**
 * Lectura de versiones. Los consumidores (acta, encuesta, medición) guardan el **id** de la versión
 * con la que generan un documento, nunca «la vigente» (RS-024, D13).
 */
export interface TemplateVersionReader {
  findById(id: string): Promise<TemplateVersion | null>;
  /** La versión Publicada de la plantilla con ese código, si existe. */
  findPublishedByCode(code: string): Promise<TemplateVersion | null>;
  findDraft(templateId: string): Promise<TemplateVersion | null>;
  findPublished(templateId: string): Promise<TemplateVersion | null>;
  /** Historial de la plantilla, de la versión más reciente (número mayor) a la más antigua. */
  listByTemplate(templateId: string): Promise<TemplateVersion[]>;
  /** Publicada y Borrador de varias plantillas en una sola consulta (sin N+1). */
  findCurrentByTemplateIds(
    templateIds: readonly string[],
  ): Promise<ReadonlyMap<string, CurrentTemplateVersions>>;
  /** Número más alto usado por la plantilla; 0 si no tiene versiones. */
  maxNumber(templateId: string): Promise<number>;
}
