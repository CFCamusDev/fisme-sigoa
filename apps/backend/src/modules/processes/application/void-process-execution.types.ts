export interface VoidProcessExecutionCommand {
  readonly executionId: string;
  readonly reason: string;
  readonly actorId: string;
  readonly ip?: string | null;
}
