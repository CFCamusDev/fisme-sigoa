import type { CreateSemesterRequest } from '@sigoa/shared';

export interface CreateSemesterCommand extends CreateSemesterRequest {
  readonly actorId: string;
  readonly ip?: string;
}
