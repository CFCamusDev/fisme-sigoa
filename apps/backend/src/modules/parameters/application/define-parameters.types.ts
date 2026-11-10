import type { DefineParametersRequest } from '@sigoa/shared';

export interface DefineParametersCommand extends DefineParametersRequest {
  readonly actorId: string;
  readonly ip?: string;
}
