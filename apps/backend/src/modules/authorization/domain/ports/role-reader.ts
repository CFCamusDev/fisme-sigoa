import type { RoleDto, RoleSummary } from '@sigoa/shared';

export interface RoleReader {
  listAll(): Promise<RoleSummary[]>;
  listDetailed(): Promise<RoleDto[]>;
  findById(id: string): Promise<RoleDto | null>;
}
