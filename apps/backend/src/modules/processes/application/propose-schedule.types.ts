export interface ProposeScheduleCommand {
  readonly actorId: string;
  readonly ip?: string | null;
  readonly executionId: string;
}
