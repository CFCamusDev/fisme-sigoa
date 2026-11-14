export interface ApproveResolutionFile {
  readonly content: Buffer;
  readonly originalName: string;
  readonly mimeType: string;
}

export interface ApproveResolutionCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly resolutionId: string;
  /** PDF firmado; `null` o vacío ⇒ `ResolutionPdfRequiredError`. */
  readonly file: ApproveResolutionFile | null;
}
