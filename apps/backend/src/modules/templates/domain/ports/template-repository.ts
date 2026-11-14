import type { Template } from '../entities/template.js';

export interface TemplateRepository {
  /**
   * Exige transacción activa: bloquea la fila de la plantilla (`SELECT … FOR UPDATE`) para
   * serializar editar y publicar sobre la misma plantilla (D5). Devuelve la plantilla o `null`.
   */
  lockForUpdate(templateId: string): Promise<Template | null>;
}
