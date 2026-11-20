export interface AnnexPdfRenderData {
  readonly scalars: Readonly<Record<string, string>>;
  readonly collections: Readonly<Record<string, readonly Readonly<Record<string, string>>[]>>;
}

export interface AnnexAuditSubject {
  readonly entity: string;
  readonly entityId: string;
  readonly metadata: Readonly<Record<string, string | number>>;
}

export interface GenerateStakeholderAnnexPdfInput {
  readonly actorId: string;
  readonly ip?: string;
  readonly annexCode: string;
  readonly data: AnnexPdfRenderData;
  readonly fileLabel: string;
  readonly subject: AnnexAuditSubject;
}

export interface GeneratedStakeholderAnnexPdf {
  readonly pdf: Buffer;
  readonly fileName: string;
  readonly templateCode: string;
  readonly versionNumber: number;
}

export interface AnnexPdfGenerator {
  generate(input: GenerateStakeholderAnnexPdfInput): Promise<GeneratedStakeholderAnnexPdf>;
}
