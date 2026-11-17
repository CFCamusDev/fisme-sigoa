import type { ProcessType } from '../domain/entities/process-type.js';

export interface CreateProcessExecutionCommand {
  readonly actorId: string;
  readonly ip?: string | null;
  readonly type: ProcessType;
  readonly year: number;
  readonly semesterId?: string | null;
  readonly catalogVersionId: string;
  readonly name?: string | null;
}
