export interface CloseProcessExecutionCommand {
  readonly executionId: string;
  readonly actorId: string;
  readonly ip?: string | null;
}
