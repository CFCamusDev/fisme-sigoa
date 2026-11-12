import type { AuditEvent } from '../../../shared/audit/audit-logger.js';

export type RefreshTokenRevocationReason = 'ROTATED' | 'LOGOUT';

export interface BuildRefreshTokenRevocationEventParams {
  tokenId: string;
  userId: string;
  revokedAt: Date;
  reason: RefreshTokenRevocationReason;
  ip?: string | null;
  replacedBy?: string;
}

export function buildRefreshTokenRevocationEvent(
  params: BuildRefreshTokenRevocationEventParams,
): AuditEvent {
  return {
    action: 'STATE_CHANGE',
    entity: 'RefreshToken',
    entityId: params.tokenId,
    actor: params.userId,
    ip: params.ip ?? undefined,
    before: {
      revokedAt: null,
    },
    after: {
      revokedAt: params.revokedAt.toISOString(),
      reason: params.reason,
      ...(params.replacedBy ? { replacedBy: params.replacedBy } : {}),
    },
  };
}
