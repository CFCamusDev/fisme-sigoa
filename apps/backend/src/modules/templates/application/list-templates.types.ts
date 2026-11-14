import type { TemplateType } from '../domain/entities/template.js';

export interface ListTemplatesCommand {
  readonly actorId: string;
  readonly type?: TemplateType;
  readonly page: number;
  readonly pageSize: number;
}

export interface GetTemplateDetailCommand {
  readonly actorId: string;
  readonly templateId: string;
}
