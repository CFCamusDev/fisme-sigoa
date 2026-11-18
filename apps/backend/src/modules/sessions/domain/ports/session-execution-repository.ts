export interface ReplaceSessionLinksInput {
  readonly sessionId: string;
  readonly executionIds: readonly string[];
  readonly actorId: string;
  readonly now: Date;
}

export interface SessionExecutionRepository {
  replaceLinks(input: ReplaceSessionLinksInput): Promise<void>;
  findExecutionIds(sessionId: string): Promise<readonly string[]>;
}
