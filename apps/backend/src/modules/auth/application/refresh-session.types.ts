import type { RefreshResponse } from '@sigoa/shared';

export interface RefreshSessionCommand {
  refreshToken: string;
  ip?: string | null;
}

export type RefreshSessionResult = RefreshResponse;
