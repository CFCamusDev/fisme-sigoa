import type { PermissionRecord } from '../entities/permission.js';

export interface PermissionRepository {
  findAll(): Promise<PermissionRecord[]>;
  findByCodes(codes: string[]): Promise<PermissionRecord[]>;
}
