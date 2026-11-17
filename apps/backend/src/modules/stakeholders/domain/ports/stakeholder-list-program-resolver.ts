export interface StakeholderListProgramResolver {
  getCurrentProgramId(): Promise<string | null>;
}
