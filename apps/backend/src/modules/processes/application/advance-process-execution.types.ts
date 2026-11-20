export interface AdvanceProcessExecutionCommand {
  readonly executionId: string;
  readonly actorId: string;
  readonly ip?: string | null;
}
