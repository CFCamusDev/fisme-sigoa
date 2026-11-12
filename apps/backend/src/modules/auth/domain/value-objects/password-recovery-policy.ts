import type { User } from '../entities/user.js';

export const PASSWORD_RECOVERY_COOLDOWN_SECONDS = 60;

export interface PasswordRecoveryEvaluationContext {
  user?: User | null;
  latestTokenCreatedAt?: Date | null;
  now: Date;
}

export type PasswordRecoverySkipReason = 'USER_NOT_FOUND' | 'USER_NOT_ACTIVE' | 'COOLDOWN';

export type PasswordRecoveryEvaluationResult =
  { action: 'ISSUE' } | { action: 'SKIP'; reason: PasswordRecoverySkipReason };

export interface PasswordRecoveryPublicResult {
  status: 'RECEIVED';
}

export class PasswordRecoveryPolicy {
  public static evaluate(
    context: PasswordRecoveryEvaluationContext,
  ): PasswordRecoveryEvaluationResult {
    const { user, latestTokenCreatedAt, now } = context;

    if (!user) {
      return { action: 'SKIP', reason: 'USER_NOT_FOUND' };
    }

    if (user.status !== 'ACTIVE') {
      return { action: 'SKIP', reason: 'USER_NOT_ACTIVE' };
    }

    if (latestTokenCreatedAt) {
      const elapsedSeconds = (now.getTime() - latestTokenCreatedAt.getTime()) / 1000;
      if (elapsedSeconds < PASSWORD_RECOVERY_COOLDOWN_SECONDS) {
        return { action: 'SKIP', reason: 'COOLDOWN' };
      }
    }

    return { action: 'ISSUE' };
  }

  public static publicResult(): PasswordRecoveryPublicResult {
    return { status: 'RECEIVED' };
  }
}
