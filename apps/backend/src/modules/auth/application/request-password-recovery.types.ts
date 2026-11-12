import type { ForgotPasswordRequest, ForgotPasswordResponse } from '@sigoa/shared';

export interface RequestPasswordRecoveryCommand extends ForgotPasswordRequest {
  ip?: string | null;
  userAgent?: string | null;
}

export type RequestPasswordRecoveryResult = ForgotPasswordResponse;
