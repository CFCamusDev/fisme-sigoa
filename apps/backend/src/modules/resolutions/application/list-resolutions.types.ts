import type { ResolutionStatus, ResolutionType } from '../domain/entities/resolution-enums.js';

export interface ListResolutionsCommand {
  readonly actorId: string;
  readonly type?: ResolutionType;
  readonly status?: ResolutionStatus;
  readonly catalogVersionId?: string;
  readonly page: number;
  readonly pageSize: number;
}
