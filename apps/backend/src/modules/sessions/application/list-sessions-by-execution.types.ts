export interface ListSessionsByExecutionQueryInput {
  readonly actorId: string;
  readonly executionId: string;
  readonly page: number;
  readonly pageSize: number;
}
