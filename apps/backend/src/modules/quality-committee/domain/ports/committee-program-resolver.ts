export interface CommitteeProgramResolver {
  getCurrentProgramId(): Promise<string | null>;
}
