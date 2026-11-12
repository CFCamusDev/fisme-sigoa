import type { ScaleType } from '../domain/entities/response-scale.js';

export interface ListResponseScalesQuery {
  readonly actorId: string;
  readonly type?: ScaleType;
}
