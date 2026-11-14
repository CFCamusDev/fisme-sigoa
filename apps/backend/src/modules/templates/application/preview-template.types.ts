import type { PreviewTemplateResponse } from '@sigoa/shared';

export interface PreviewTemplateCommand {
  readonly actorId: string;
  readonly templateId: string;
  readonly content: string;
}

export type PreviewTemplateResult = PreviewTemplateResponse;
