export interface ConfirmStakeholderImportCommand {
  readonly listId: string;
  readonly fileBuffer: Buffer;
  readonly actorId: string;
  readonly ip?: string | null;
}
