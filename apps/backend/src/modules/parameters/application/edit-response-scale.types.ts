import type { UpdateResponseScaleRequest } from '@sigoa/shared';

export interface EditResponseScaleCommand extends UpdateResponseScaleRequest {
  readonly actorId: string;
  readonly ip?: string;
  readonly id: string;
}
