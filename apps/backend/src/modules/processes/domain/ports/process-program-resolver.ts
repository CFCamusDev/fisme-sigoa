export interface ProcessProgramResolver {
  getCurrentProgramId(): Promise<string | null>;
}
