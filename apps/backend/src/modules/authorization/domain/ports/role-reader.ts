import type { RoleDto } from '@sigoa/shared';

export interface RoleReader {
  listAll(): Promise<RoleDto[]>;
  findById(id: string): Promise<RoleDto | null>;
}
