import type { ActivateAccountRequest, ActivateAccountResponse } from '@sigoa/shared';

export interface ActivateAccountCommand extends ActivateAccountRequest {
  ip?: string | null;
  userAgent?: string | null;
}

export type ActivateAccountResult = ActivateAccountResponse;
