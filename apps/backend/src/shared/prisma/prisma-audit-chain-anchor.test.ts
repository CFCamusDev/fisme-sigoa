import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbProvider } from './prisma-unit-of-work.js';
import { AUDIT_CHAIN_HEAD_ID, PrismaAuditChainAnchor } from './prisma-audit-chain-anchor.js';

describe('PrismaAuditChainAnchor (Unit, RS-042, RNF-015)', () => {
  let mockAuditChainHeadClient: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  let mockDbProvider: DbProvider;
  let anchor: PrismaAuditChainAnchor;

  beforeEach(() => {
    mockAuditChainHeadClient = {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    };

    mockDbProvider = {
      get: vi.fn().mockReturnValue({
        auditChainHead: mockAuditChainHeadClient,
      }),
    };

    anchor = new PrismaAuditChainAnchor(mockDbProvider);
  });

  it('advances head by performing upsert on row with id MAIN', async () => {
    await anchor.advance({
      sequence: 15n,
      hash: 'mocked_hash_15',
    });

    expect(mockAuditChainHeadClient.upsert).toHaveBeenCalledWith({
      where: { id: AUDIT_CHAIN_HEAD_ID },
      create: {
        id: AUDIT_CHAIN_HEAD_ID,
        sequence: 15n,
        hash: 'mocked_hash_15',
      },
      update: {
        sequence: 15n,
        hash: 'mocked_hash_15',
      },
    });
  });

  it('reads head state correctly when row exists', async () => {
    mockAuditChainHeadClient.findUnique.mockResolvedValue({
      sequence: 15n,
      hash: 'mocked_hash_15',
    });

    const result = await anchor.read();

    expect(result).toEqual({
      sequence: 15n,
      hash: 'mocked_hash_15',
    });
    expect(mockAuditChainHeadClient.findUnique).toHaveBeenCalledWith({
      where: { id: AUDIT_CHAIN_HEAD_ID },
      select: { sequence: true, hash: true },
    });
  });

  it('returns null when head row does not exist', async () => {
    mockAuditChainHeadClient.findUnique.mockResolvedValue(null);

    const result = await anchor.read();

    expect(result).toBeNull();
  });
});
