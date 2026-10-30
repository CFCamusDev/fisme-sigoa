import type { LoginResponse } from '@sigoa/shared';

export interface LoginCommand {
  email: string;
  password: string;
  ip: string;
}

export type LoginResult = LoginResponse;

export type LoginFailureReason =
  'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_INACTIVE' | 'ACCOUNT_PENDING_ACTIVATION';

export type LoginOutcome =
  | { outcome: 'SUCCESS'; result: LoginResult }
  | { outcome: 'INVALID_CREDENTIALS' }
  | { outcome: 'ACCOUNT_LOCKED'; retryAfterSeconds: number }
  | { outcome: 'ACCOUNT_INACTIVE' }
  | { outcome: 'ACCOUNT_PENDING_ACTIVATION' };
