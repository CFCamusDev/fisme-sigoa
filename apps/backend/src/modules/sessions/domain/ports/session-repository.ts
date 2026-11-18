import type { Session } from '../entities/session.js';

export interface SessionRepository {
  save(session: Session): Promise<void>;
  update(session: Session): Promise<void>;
  findByIdForUpdate(id: string): Promise<Session | null>;
}
