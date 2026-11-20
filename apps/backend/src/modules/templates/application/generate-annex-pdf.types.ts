import type { TemplateRenderData } from '../domain/policies/template-renderer.js';

export interface AnnexAuditSubject {
  readonly entity: string;
  readonly entityId: string;
  readonly metadata?: Readonly<Record<string, string | number>>;
}

export interface GenerateAnnexPdfCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly annexCode: string;
  readonly data?: Partial<TemplateRenderData>;
  readonly subject?: AnnexAuditSubject;
  readonly fileLabel?: string;
}

export interface GenerateAnnexPdfResult {
  readonly pdf: Buffer;
  readonly fileName: string;
  readonly templateCode: string;
  readonly versionNumber: number;
}
