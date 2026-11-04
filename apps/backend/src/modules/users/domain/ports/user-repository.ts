import type { User } from '../entities/user.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByIdForUpdate(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByDni(dni: string): Promise<User | null>;
  add(user: User): Promise<void>;
  save(user: User): Promise<void>;
}
