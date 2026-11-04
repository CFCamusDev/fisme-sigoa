import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { RefreshSessionUseCase } from './refresh-session.js';
import { User, type UserStatus } from '../domain/entities/user.js';
import { RefreshToken } from '../domain/entities/refresh-token.js';
import { InvalidRefreshTokenError } from '../domain/errors/index.js';
import type {
  AccessTokenSigner,
  RefreshTokenGenerator,
  RefreshTokenRepository,
  UserRepository,
} from '../domain/ports/index.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';

describe('RefreshSessionUseCase (T-002-13, CA1, CA3, RF-002, RS-016, RS-020, RNF-004)', () => {
  const fixedNow = new Date('2026-11-02T16:00:00.000Z');
  const clock = () => fixedNow;

  function createTestUser(id = 'usr_active_1', status: UserStatus = 'ACTIVE'): User {
    return User.restore({
      id,
      names: 'Carlos',
      firstSurname: 'Pérez',
      secondSurname: 'Gómez',
      email: 'carlos.perez@untrm.edu.pe',
      dni: '87654321',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
      status,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date('2026-11-01T10:00:00.000Z'),
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      createdBy: null,
      updatedBy: null,
    });
  }

  function createTestRefreshToken(
    overrides: Partial<Parameters<typeof RefreshToken.restore>[0]> = {},
  ): RefreshToken {
    return RefreshToken.restore({
      id: 'rt_old_1',
      userId: 'usr_active_1',
      tokenHash: 'hash_sha256_of_old_token',
      expiresAt: new Date('2026-11-09T16:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-11-02T09:00:00.000Z'),
      createdByIp: '192.168.1.5',
      ...overrides,
    });
  }

  function setup() {
    const userRepository = mock<UserRepository>();
    const refreshTokenRepository = mock<RefreshTokenRepository>();
    const accessTokenSigner = mock<AccessTokenSigner>();
    const refreshTokenGenerator = mock<RefreshTokenGenerator>();
    const auditLogger = mock<AuditLogger>();

    const unitOfWork: UnitOfWork = {
      run: vi.fn(async (fn) => fn()),
    };

    refreshTokenGenerator.hash.mockImplementation((t) => `hash_of_${t}`);
    refreshTokenGenerator.generate.mockReturnValue({
      token: 'default_token',
      tokenHash: 'default_token_hash',
      expiresAt: new Date('2026-11-09T16:00:00.000Z'),
    });

    const useCase = new RefreshSessionUseCase({
      userRepository,
      refreshTokenRepository,
      accessTokenSigner,
      refreshTokenGenerator,
      unitOfWork,
      auditLogger,
      clock,
    });

    return {
      useCase,
      userRepository,
      refreshTokenRepository,
      accessTokenSigner,
      refreshTokenGenerator,
      unitOfWork,
      auditLogger,
    };
  }

  it('rotates the refresh token and issues a new access token (CA1)', async () => {
    const {
      useCase,
      userRepository,
      refreshTokenRepository,
      accessTokenSigner,
      refreshTokenGenerator,
      auditLogger,
    } = setup();

    const oldToken = createTestRefreshToken();
    const user = createTestUser('usr_active_1');

    refreshTokenGenerator.hash.mockReturnValue('valid_hash');
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(oldToken);
    userRepository.findById.mockResolvedValue(user);

    const newExpiresAt = new Date('2026-11-09T16:00:00.000Z');
    refreshTokenGenerator.generate.mockReturnValue({
      token: 'new_refresh_token_opaque',
      tokenHash: 'new_refresh_token_hash',
      expiresAt: newExpiresAt,
    });

    const accessExpiresAt = new Date('2026-11-02T16:15:00.000Z');
    accessTokenSigner.sign.mockResolvedValue({
      token: 'new.access.jwt',
      expiresAt: accessExpiresAt,
    });

    const result = await useCase.execute({
      refreshToken: 'old_refresh_token',
      ip: '10.0.0.1',
    });

    expect(result.accessToken).toBe('new.access.jwt');
    expect(result.accessTokenExpiresAt).toBe(accessExpiresAt.toISOString());
    expect(result.refreshToken).toBe('new_refresh_token_opaque');
    expect(result.refreshTokenExpiresAt).toBe(newExpiresAt.toISOString());
    expect(result.user).toEqual({
      id: 'usr_active_1',
      names: 'Carlos',
      firstSurname: 'Pérez',
      secondSurname: 'Gómez',
      email: 'carlos.perez@untrm.edu.pe',
    });

    expect(oldToken.isRevoked()).toBe(true);
    expect(oldToken.revokedAt).toEqual(fixedNow);
    expect(refreshTokenRepository.save).toHaveBeenCalledWith(oldToken);
    expect(refreshTokenRepository.add).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_active_1',
        tokenHash: 'new_refresh_token_hash',
        expiresAt: newExpiresAt,
        createdByIp: '10.0.0.1',
      }),
    );
    expect(auditLogger.log).toHaveBeenCalledWith({
      action: 'STATE_CHANGE',
      entity: 'RefreshToken',
      entityId: oldToken.id,
      actor: user.id,
      ip: '10.0.0.1',
      before: { revokedAt: null },
      after: {
        revokedAt: fixedNow.toISOString(),
        reason: 'ROTATED',
        replacedBy: expect.any(String),
      },
    });
  });

  it('persists the old token as revoked and stores only the new token hash', async () => {
    const {
      useCase,
      userRepository,
      refreshTokenRepository,
      accessTokenSigner,
      refreshTokenGenerator,
    } = setup();

    const oldToken = createTestRefreshToken();
    refreshTokenGenerator.hash.mockReturnValue('hash_val');
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(oldToken);
    userRepository.findById.mockResolvedValue(createTestUser());

    refreshTokenGenerator.generate.mockReturnValue({
      token: 'raw_new_token',
      tokenHash: 'sha256_hash_only',
      expiresAt: new Date('2026-11-09T16:00:00.000Z'),
    });
    accessTokenSigner.sign.mockResolvedValue({
      token: 'jwt',
      expiresAt: new Date('2026-11-02T16:15:00.000Z'),
    });

    await useCase.execute({ refreshToken: 'raw_old_token' });

    expect(refreshTokenRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: oldToken.id,
        revokedAt: fixedNow,
      }),
    );
    expect(refreshTokenRepository.add).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: 'sha256_hash_only',
      }),
    );
  });

  it('returns the user without sensitive fields', async () => {
    const {
      useCase,
      userRepository,
      refreshTokenRepository,
      accessTokenSigner,
      refreshTokenGenerator,
    } = setup();

    refreshTokenGenerator.hash.mockReturnValue('h');
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(createTestRefreshToken());
    userRepository.findById.mockResolvedValue(createTestUser());
    refreshTokenGenerator.generate.mockReturnValue({
      token: 'tok',
      tokenHash: 'th',
      expiresAt: new Date('2026-11-09T16:00:00.000Z'),
    });
    accessTokenSigner.sign.mockResolvedValue({
      token: 'jwt',
      expiresAt: new Date('2026-11-02T16:15:00.000Z'),
    });

    const result = await useCase.execute({ refreshToken: 'tok' });

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('dni');
    expect(result.user).not.toHaveProperty('failedLoginAttempts');
    expect(result.user).not.toHaveProperty('status');
  });

  it('rejects an unknown refresh token with 401', async () => {
    const { useCase, refreshTokenRepository, refreshTokenGenerator, auditLogger } = setup();

    refreshTokenGenerator.hash.mockReturnValue('unknown_hash');
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(null);

    await expect(useCase.execute({ refreshToken: 'unknown' })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a revoked, expired or unknown refresh token with 401 (CA3)', async () => {
    const { useCase, userRepository, refreshTokenRepository } = setup();

    // 1. Desconocido
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(null);
    let unknownError: unknown;
    try {
      await useCase.execute({ refreshToken: 'un' });
    } catch (err) {
      unknownError = err;
    }

    // 2. Vencido
    const expiredToken = createTestRefreshToken({
      expiresAt: new Date('2026-10-20T00:00:00.000Z'),
    });
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(expiredToken);
    userRepository.findById.mockResolvedValue(createTestUser());
    let expiredError: unknown;
    try {
      await useCase.execute({ refreshToken: 'exp' });
    } catch (err) {
      expiredError = err;
    }

    // 3. Ya revocado
    const revokedToken = createTestRefreshToken({
      revokedAt: new Date('2026-11-01T12:00:00.000Z'),
    });
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(revokedToken);
    let revokedError: unknown;
    try {
      await useCase.execute({ refreshToken: 'rev' });
    } catch (err) {
      revokedError = err;
    }

    expect(unknownError).toBeInstanceOf(InvalidRefreshTokenError);
    expect(expiredError).toBeInstanceOf(InvalidRefreshTokenError);
    expect(revokedError).toBeInstanceOf(InvalidRefreshTokenError);

    const err1 = unknownError as InvalidRefreshTokenError;
    const err2 = expiredError as InvalidRefreshTokenError;
    const err3 = revokedError as InvalidRefreshTokenError;

    expect(err1.httpStatus).toBe(401);
    expect(err1.code).toBe('UNAUTHORIZED');
    expect(err1.message).toBe('La sesión expiró o ya no es válida. Inicia sesión nuevamente.');
    expect(err2.message).toBe(err1.message);
    expect(err3.message).toBe(err1.message);
  });

  it('rejects the previous refresh token after rotation', async () => {
    const {
      useCase,
      userRepository,
      refreshTokenRepository,
      accessTokenSigner,
      refreshTokenGenerator,
    } = setup();

    const token = createTestRefreshToken();
    refreshTokenGenerator.hash.mockReturnValue('hash');
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);
    userRepository.findById.mockResolvedValue(createTestUser());
    refreshTokenGenerator.generate.mockReturnValue({
      token: 'new_tok',
      tokenHash: 'new_hash',
      expiresAt: new Date('2026-11-09T16:00:00.000Z'),
    });
    accessTokenSigner.sign.mockResolvedValue({
      token: 'jwt',
      expiresAt: new Date('2026-11-02T16:15:00.000Z'),
    });

    // Primera rotación
    await useCase.execute({ refreshToken: 'tok' });

    // Intento con el mismo token ya rotado (token.isRevoked() === true)
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);
    await expect(useCase.execute({ refreshToken: 'tok' })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it('rejects a refresh token of an inactive or pending user', async () => {
    const { useCase, userRepository, refreshTokenRepository } = setup();

    const token = createTestRefreshToken();
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);

    // Caso 1: INACTIVE
    userRepository.findById.mockResolvedValueOnce(createTestUser('usr_1', 'INACTIVE'));
    await expect(useCase.execute({ refreshToken: 'tok' })).rejects.toThrow(
      InvalidRefreshTokenError,
    );

    // Caso 2: PENDING_ACTIVATION
    userRepository.findById.mockResolvedValueOnce(createTestUser('usr_1', 'PENDING_ACTIVATION'));
    await expect(useCase.execute({ refreshToken: 'tok' })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it('rejects a refresh token whose user no longer exists', async () => {
    const { useCase, userRepository, refreshTokenRepository } = setup();

    const token = createTestRefreshToken();
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ refreshToken: 'tok' })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it('audits the rotation in the same transaction', async () => {
    const {
      useCase,
      userRepository,
      refreshTokenRepository,
      accessTokenSigner,
      refreshTokenGenerator,
      unitOfWork,
      auditLogger,
    } = setup();

    const oldToken = createTestRefreshToken();
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(oldToken);
    userRepository.findById.mockResolvedValue(createTestUser('usr_aud'));

    refreshTokenGenerator.generate.mockReturnValue({
      token: 'secret_new_raw_token_xyz',
      tokenHash: 'new_token_hash_secret_123',
      expiresAt: new Date('2026-11-09T16:00:00.000Z'),
    });
    accessTokenSigner.sign.mockResolvedValue({
      token: 'jwt',
      expiresAt: new Date('2026-11-02T16:15:00.000Z'),
    });

    let loggedInsideRun = false;
    unitOfWork.run = vi.fn(async (fn) => {
      const res = await fn();
      expect(auditLogger.log).toHaveBeenCalled();
      loggedInsideRun = true;
      return res;
    });

    await useCase.execute({ refreshToken: 'secret_old_raw_token_abc', ip: '10.20.30.40' });

    expect(loggedInsideRun).toBe(true);

    const auditCall = auditLogger.log.mock.calls[0]![0];
    expect(auditCall.action).toBe('STATE_CHANGE');
    expect(auditCall.entity).toBe('RefreshToken');
    expect(auditCall.entityId).toBe(oldToken.id);
    expect(auditCall.actor).toBe('usr_aud');
    expect(auditCall.ip).toBe('10.20.30.40');

    // Verificar que NUNCA aparezcan tokens ni hashes en el payload de auditoría
    const serialized = JSON.stringify(auditCall);
    expect(serialized).not.toContain('secret_old_raw_token_abc');
    expect(serialized).not.toContain('secret_new_raw_token_xyz');
    expect(serialized).not.toContain('new_token_hash_secret_123');
    expect(serialized).not.toContain(oldToken.tokenHash);
  });

  it('does not return tokens when the audit fails', async () => {
    const {
      useCase,
      userRepository,
      refreshTokenRepository,
      accessTokenSigner,
      refreshTokenGenerator,
      auditLogger,
    } = setup();

    const oldToken = createTestRefreshToken();
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(oldToken);
    userRepository.findById.mockResolvedValue(createTestUser());
    refreshTokenGenerator.generate.mockReturnValue({
      token: 'new_token',
      tokenHash: 'new_hash',
      expiresAt: new Date('2026-11-09T16:00:00.000Z'),
    });
    accessTokenSigner.sign.mockResolvedValue({
      token: 'jwt',
      expiresAt: new Date('2026-11-02T16:15:00.000Z'),
    });

    auditLogger.log.mockRejectedValue(new Error('Audit DB write error'));

    await expect(useCase.execute({ refreshToken: 'tok' })).rejects.toThrow('Audit DB write error');
  });

  it('does not audit a rejected refresh', async () => {
    const { useCase, refreshTokenRepository, auditLogger } = setup();

    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(null);

    await expect(useCase.execute({ refreshToken: 'tok' })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('uses the injected clock for expiry', async () => {
    const customClockDate = new Date('2026-12-01T00:00:00.000Z');
    const { userRepository, refreshTokenRepository, accessTokenSigner, refreshTokenGenerator } =
      setup();

    const useCaseWithCustomClock = new RefreshSessionUseCase({
      userRepository,
      refreshTokenRepository,
      accessTokenSigner,
      refreshTokenGenerator,
      unitOfWork: { run: async (fn) => fn() },
      auditLogger: mock<AuditLogger>(),
      clock: () => customClockDate,
    });

    const token = createTestRefreshToken({
      expiresAt: new Date('2026-12-05T00:00:00.000Z'),
    });
    refreshTokenRepository.findByTokenHashForUpdate.mockResolvedValue(token);
    userRepository.findById.mockResolvedValue(createTestUser());

    refreshTokenGenerator.generate.mockReturnValue({
      token: 'new',
      tokenHash: 'nh',
      expiresAt: new Date('2026-12-08T00:00:00.000Z'),
    });
    accessTokenSigner.sign.mockResolvedValue({
      token: 'jwt',
      expiresAt: new Date('2026-12-01T00:15:00.000Z'),
    });

    await useCaseWithCustomClock.execute({ refreshToken: 'tok' });

    expect(accessTokenSigner.sign).toHaveBeenCalledWith(expect.anything(), customClockDate);
    expect(refreshTokenGenerator.generate).toHaveBeenCalledWith(customClockDate);
  });
});
