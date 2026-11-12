import type { DuplicateResponseScaleRequest } from '@sigoa/shared';

export interface DuplicateResponseScaleCommand extends DuplicateResponseScaleRequest {
  readonly actorId: string;
  readonly ip?: string;
  readonly sourceId: string;
}
