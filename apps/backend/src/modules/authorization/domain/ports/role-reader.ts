import type { RoleSummary } from '@sigoa/shared';

export interface RoleReader {
  listAll(): Promise<RoleSummary[]>;
}
