import type { UserStatus } from '@sigoa/shared';
import type { User } from '../entities/user.js';

export interface UserListFilter {
  readonly status?: UserStatus;
  readonly roleId?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface UserListResult {
  readonly items: User[];
  readonly total: number;
}

export interface UserListReader {
  list(filter: UserListFilter): Promise<UserListResult>;
}
