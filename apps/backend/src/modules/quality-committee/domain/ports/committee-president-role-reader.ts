import type { PresidentRoleHolder } from '../policies/president-alert.js';

export interface CommitteePresidentRoleReader {
  listActiveHolders(): Promise<readonly PresidentRoleHolder[]>;
}
