import type { ResolutionType } from '../domain/entities/resolution-enums.js';

export interface RegisterResolutionCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly type: ResolutionType;
  readonly number: string;
  /** Fecha de calendario `AAAA-MM-DD`. */
  readonly issuedOn: string;
  readonly catalogVersionId: string;
}
