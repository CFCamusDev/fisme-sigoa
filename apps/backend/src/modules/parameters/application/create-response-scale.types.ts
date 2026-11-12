import type { CreateResponseScaleRequest } from '@sigoa/shared';

export interface CreateResponseScaleCommand extends CreateResponseScaleRequest {
  readonly actorId: string;
  readonly ip?: string;
}
