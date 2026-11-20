export interface GenerateAnnexPdfCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly annexCode: string;
}

export interface GenerateAnnexPdfResult {
  readonly pdf: Buffer;
  readonly fileName: string;
  readonly templateCode: string;
  readonly versionNumber: number;
}
