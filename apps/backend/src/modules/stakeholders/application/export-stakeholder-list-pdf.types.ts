export interface ExportStakeholderListPdfCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly listId: string;
}

export interface ExportStakeholderListPdfResult {
  readonly pdf: Buffer;
  readonly fileName: string;
  readonly templateCode: string;
  readonly versionNumber: number;
}
