import { describe, expect, it, vi } from 'vitest';
import { ActivationTokenIssuerService } from './activation-token-issuer-service.js';
import type { ActivationTokenRepository } from '../domain/ports/activation-token-repository.js';
import type { ActivationTokenGenerator } from '../domain/ports/activation-token-generator.js';
import type { ActivationToken } from '../domain/entities/activation-token.js';

describe('ActivationTokenIssuerService Unit Tests (F5, RS-016)', () => {
  it('returns a token whose hash is what is stored in repository and invalidates previous pending tokens', async () => {
    let savedToken: ActivationToken | null = null;
    const revokedUsers: { userId: string; now: Date }[] = [];

    const mockRepo: ActivationTokenRepository = {
      add: vi.fn().mockImplementation(async (token: ActivationToken) => {
        savedToken = token;
      }),
      findByTokenHash: vi.fn(),
      findByTokenHashForUpdate: vi.fn(),
      save: vi.fn(),
      revokePendingByUserId: vi.fn().mockImplementation(async (userId: string, now: Date) => {
        revokedUsers.push({ userId, now });
      }),
    };

    const mockGenerator: ActivationTokenGenerator = {
      lifetimeHours: 48,
      hash: vi.fn().mockReturnValue('mock-hash-12345'),
      generate: vi.fn().mockReturnValue({
        token: 'plain-secret-token-xyz',
        tokenHash: 'mock-hash-12345',
        expiresAt: new Date('2026-11-03T10:00:00.000Z'),
      }),
    };

    const service = new ActivationTokenIssuerService(mockRepo, mockGenerator);
    const issuanceTime = new Date('2026-11-01T10:00:00.000Z');

    const result = await service.issue('user-target-id', issuanceTime, 'admin-creator-id');

    // 1. Invalida tokens previos
    expect(mockRepo.revokePendingByUserId).toHaveBeenCalledWith('user-target-id', issuanceTime);
    expect(revokedUsers).toHaveLength(1);

    // 2. Retorna el token en claro y su fecha
    expect(result.token).toBe('plain-secret-token-xyz');
    expect(result.expiresAt).toEqual(new Date('2026-11-03T10:00:00.000Z'));

    // 3. Almacena únicamente el HASH en el repositorio (nunca el texto en claro)
    expect(mockRepo.add).toHaveBeenCalledTimes(1);
    expect(savedToken).toBeDefined();
    const tokenEntity = savedToken as unknown as ActivationToken;
    expect(tokenEntity.tokenHash).toBe('mock-hash-12345');
    expect(tokenEntity.userId).toBe('user-target-id');
    expect(tokenEntity.createdBy).toBe('admin-creator-id');
    expect((tokenEntity as unknown as { token?: string }).token).toBeUndefined();
  });
});
