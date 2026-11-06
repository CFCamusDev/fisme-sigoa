import type { Role } from '../entities/role.js';

export interface RoleRepository {
  findById(id: string): Promise<Role | null>;
  findByIdForUpdate(id: string): Promise<Role | null>;
  findByCode(code: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  add(role: Role): Promise<void>;
}
