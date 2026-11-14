import type { Template, TemplateType } from '../entities/template.js';

export interface ListTemplatesFilter {
  readonly type?: TemplateType;
  readonly page: number;
  readonly pageSize: number;
}

export interface TemplatePage {
  readonly items: Template[];
  readonly total: number;
}

export interface TemplateReader {
  findById(id: string): Promise<Template | null>;
  findByCode(code: string): Promise<Template | null>;
  /** Plantillas ordenadas por código; `total` cuenta las que cumplen el filtro, sin paginar. */
  list(filter: ListTemplatesFilter): Promise<TemplatePage>;
}
