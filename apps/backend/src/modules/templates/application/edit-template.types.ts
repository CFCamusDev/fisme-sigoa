import type { TemplateVersionDto } from '@sigoa/shared';

export interface EditTemplateCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly templateId: string;
  readonly content: string;
}

export interface EditTemplateResult {
  /** `true` si se creó un Borrador nuevo (201); `false` si se actualizó o no cambió (200). */
  readonly created: boolean;
  readonly version: TemplateVersionDto;
}
