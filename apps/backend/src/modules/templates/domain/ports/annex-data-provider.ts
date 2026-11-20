import type { TemplateRenderData } from '../policies/template-renderer.js';

export interface AnnexDataProviderInput {
  readonly annexCode: string;
  readonly generatedAt: Date;
}

/**
 * Puerto para proveer datos reales de un anexo oficial según su código (D2).
 * Cada módulo dueño de proceso registra su adaptador sin acoplar `templates` a otros módulos.
 */
export interface AnnexDataProvider {
  supports(annexCode: string): boolean;
  provide(input: AnnexDataProviderInput): Promise<Partial<TemplateRenderData>>;
}
