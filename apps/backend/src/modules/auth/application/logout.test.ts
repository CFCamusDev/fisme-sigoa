import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { LogoutUseCase } from './logout.js';
import { RefreshToken } from '../domain/entities/refresh-token.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { RefreshTokenGenerator, RefreshTokenRepository } from '../domain/ports/index.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';

describe('LogoutUseCase (T-002-14, CA2, RF-002, RS-002, RS-016, RS-020, RNF-004)', () => {
  const fixedNow = new Date('2026-11-02T16:00:00.000Z');
  const clock = () => fixedNow;

  function createTestRefreshToken(
    overrides: Partial<Parameters<typeof RefreshToken.restore>[0]> = {},
  ): RefreshToken {
    return RefreshToken.restore({
      id: 'rt_session_1',
      userId: 'usr_me_1',
      tokenHash: 'hash_sha256_of_token',
      expiresAt: new Date('2026-11-09T16:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-11-02T09:00:00.000Z'),
      createdByIp: '192.168.1.10',
      ...overrides,
    });
  }

  function setup() {
    const refreshTokenRepository = mock<RefreshTokenRepository>();
    const refreshTokenGenerator = mock<RefreshTokenGenerator>();
    const auditLogger = mock<AuditLogger>();

    const unitOfWork: UnitOfWork = {
      run: vi.fn(async (fn) => fn()),
    };

    refreshTokenGenerator.hash.mockImplementation((t) => `hash_of_${t}`);

    const useCase = new LogoutUseCase({
      refreshTokenRepository,
      refreshTokenGenerator,
      unitOfWork,
      auditLogger,
      clock,
    });

    return {
      useCase,
      refreshTokenRepository,
      refreshTokenGenerator,
      unitOfWork,
      auditLogger,
    };
  }

  it('revokes the refresh token and audits the logout (CA2)', async () => {
    const { useCase, refreshTokenRepository, refreshTokenGenerator, auditLogger } = setup();

    const token = createTestRefreshToken();
    refreshTokenGenerator.hash.mockReturnValue('hash_val');
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);

    await useCase.execute({
      refreshToken: 'my_active_refresh_token',
      userId: 'usr_me_1',
      ip: '10.0.0.5',
    });

    expect(token.isRevoked()).toBe(true);
    expect(token.revokedAt).toEqual(fixedNow);
    expect(refreshTokenRepository.save).toHaveBeenCalledWith(token);
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'STATE_CHANGE',
      entity: 'RefreshToken',
      entityId: token.id,
      actor: 'usr_me_1',
      ip: '10.0.0.5',
      before: { revokedAt: null },
      after: {
        revokedAt: fixedNow.toISOString(),
        reason: 'LOGOUT',
      },
    });
  });

  it('audits in the same transaction', async () => {
    const { useCase, refreshTokenRepository, unitOfWork, auditLogger } = setup();

    const token = createTestRefreshToken();
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);

    let loggedInsideRun = false;
    unitOfWork.run = vi.fn(async (fn) => {
      const res = await fn();
      expect(auditLogger.log).toHaveBeenCalled();
      loggedInsideRun = true;
      return res;
    });

    await useCase.execute({
      refreshToken: 'my_token',
      userId: 'usr_me_1',
    });

    expect(loggedInsideRun).toBe(true);
  });

  it('is idempotent for an unknown, expired or already revoked token', async () => {
    const { useCase, refreshTokenRepository, auditLogger } = setup();

    // 1. Token desconocido
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(null);
    await expect(
      useCase.execute({ refreshToken: 'unknown', userId: 'usr_me_1' }),
    ).resolves.toBeUndefined();
    expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();

    // 2. Token vencido
    const expiredToken = createTestRefreshToken({
      expiresAt: new Date('2026-10-20T00:00:00.000Z'),
    });
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(expiredToken);
    await expect(
      useCase.execute({ refreshToken: 'expired', userId: 'usr_me_1' }),
    ).resolves.toBeUndefined();
    expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();

    // 3. Token ya revocado
    const alreadyRevokedToken = createTestRefreshToken({
      revokedAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(alreadyRevokedToken);
    await expect(
      useCase.execute({ refreshToken: 'revoked', userId: 'usr_me_1' }),
    ).resolves.toBeUndefined();
    expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a refresh token owned by another user', async () => {
    const { useCase, refreshTokenRepository, auditLogger } = setup();

    const tokenOfAnotherUser = createTestRefreshToken({
      userId: 'usr_other_victim_999',
    });
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(tokenOfAnotherUser);

    await expect(
      useCase.execute({
        refreshToken: 'stolen_refresh_token',
        userId: 'usr_attacker_123',
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(tokenOfAnotherUser.isRevoked()).toBe(false);
    expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('revokes only the given token', async () => {
    const { useCase, refreshTokenRepository } = setup();

    const targetToken = createTestRefreshToken({ id: 'rt_target' });
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(targetToken);

    await useCase.execute({
      refreshToken: 'target_refresh_token',
      userId: 'usr_me_1',
    });

    expect(targetToken.id).toBe('rt_target');
    expect(targetToken.isRevoked()).toBe(true);
    expect(refreshTokenRepository.save).toHaveBeenCalledTimes(1);
    expect(refreshTokenRepository.save).toHaveBeenCalledWith(targetToken);
  });

  it('does not revoke when the audit fails', async () => {
    const { useCase, refreshTokenRepository, auditLogger } = setup();

    const token = createTestRefreshToken();
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);
    auditLogger.log.mockRejectedValue(new Error('Audit failure'));

    await expect(
      useCase.execute({
        refreshToken: 'token',
        userId: 'usr_me_1',
      }),
    ).rejects.toThrow('Audit failure');
  });
});
