import type { ResetPasswordRequest, ResetPasswordResponse } from '@sigoa/shared';

export interface ResetPasswordCommand extends ResetPasswordRequest {
  ip?: string | null;
  userAgent?: string | null;
}

export type ResetPasswordResult = ResetPasswordResponse;
