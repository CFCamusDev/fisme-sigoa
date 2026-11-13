import type { ResolutionStatus, ResolutionType } from '../entities/resolution-enums.js';
import type { Resolution } from '../entities/resolution.js';

export interface ListResolutionsFilter {
  readonly type?: ResolutionType;
  readonly status?: ResolutionStatus;
  readonly catalogVersionId?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface ResolutionPage {
  readonly items: Resolution[];
  readonly total: number;
}

export interface ResolutionReader {
  findById(id: string): Promise<Resolution | null>;
  /** Más recientes primero (`createdAt` descendente, `id` como desempate estable). */
  list(filter: ListResolutionsFilter): Promise<ResolutionPage>;
}
