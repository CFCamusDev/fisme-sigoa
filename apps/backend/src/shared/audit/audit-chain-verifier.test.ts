import { describe, expect, it } from 'vitest';
import {
  createValidAuditChain,
  InMemoryAuditChainReader,
} from '../../test/audit/audit-chain-builder.js';
import { computeAuditHash } from './audit-hash.js';
import { AuditChainVerifier } from './audit-chain-verifier.js';

describe('AuditChainVerifier (Unit, RS-042, RNF-015)', () => {
  it('reports valid for an intact chain across batch boundaries', async () => {
    const chain = createValidAuditChain(5);
    const reader = new InMemoryAuditChainReader(chain);
    const verifier = new AuditChainVerifier(reader);

    const result = await verifier.verify(2);

    expect(result).toEqual({
      valid: true,
      checked: 5,
    });
  });

  it('reports valid with checked: 0 for an empty chain without anchor', async () => {
    const reader = new InMemoryAuditChainReader([]);
    const verifier = new AuditChainVerifier(reader);

    const result = await verifier.verify(500);

    expect(result).toEqual({
      valid: true,
      checked: 0,
    });
  });

  it('reports HASH_MISMATCH when a record payload is altered in place', async () => {
    const chain = createValidAuditChain(5);
    // Alteramos el payload del registro 3
    const record3 = chain[2]!;
    record3.after = { version: 999, hacked: true };

    const reader = new InMemoryAuditChainReader(chain);
    const verifier = new AuditChainVerifier(reader);

    const result = await verifier.verify(2);

    expect(result).toEqual({
      valid: false,
      checked: 2,
      firstInvalid: {
        sequence: 3n,
        reason: 'HASH_MISMATCH',
      },
    });
  });

  it('reports PREVIOUS_HASH_MISMATCH on the next record when a previous record hash is recalculated', async () => {
    const chain = createValidAuditChain(4);
    // Alteramos el registro 2 y recalculamos su hash
    const record2 = chain[1]!;
    record2.after = { version: 2, forged: true };
    record2.hash = computeAuditHash({
      action: record2.action,
      actor: record2.actor,
      after: record2.after,
      before: record2.before,
      entity: record2.entity,
      entityId: record2.entityId,
      ip: record2.ip,
      occurredAt: record2.occurredAt,
      previousHash: record2.previousHash,
      requestId: record2.requestId,
      sequence: record2.sequence,
    });

    const reader = new InMemoryAuditChainReader(chain);
    const verifier = new AuditChainVerifier(reader);

    // Registro 2 es internamente consistente consigo mismo, pero el registro 3
    // guarda previousHash del hash original del registro 2 -> se detecta en el registro 3
    const result = await verifier.verify(2);

    expect(result).toEqual({
      valid: false,
      checked: 2,
      firstInvalid: {
        sequence: 3n,
        reason: 'PREVIOUS_HASH_MISMATCH',
      },
    });
  });

  it('reports SEQUENCE_GAP when an intermediate record has been deleted', async () => {
    const chain = createValidAuditChain(5);
    // Eliminamos el registro 3 (quedan secuencias 1, 2, 4, 5)
    chain.splice(2, 1);

    const reader = new InMemoryAuditChainReader(chain);
    const verifier = new AuditChainVerifier(reader);

    const result = await verifier.verify(2);

    expect(result).toEqual({
      valid: false,
      checked: 2,
      firstInvalid: {
        sequence: 4n,
        reason: 'SEQUENCE_GAP',
      },
    });
  });

  it('reports SEQUENCE_GAP when the chain does not start at sequence 1', async () => {
    const chain = createValidAuditChain(4);
    // Eliminamos el primer registro (quedan secuencias 2, 3, 4)
    chain.shift();

    const reader = new InMemoryAuditChainReader(chain);
    const verifier = new AuditChainVerifier(reader);

    const result = await verifier.verify(2);

    expect(result).toEqual({
      valid: false,
      checked: 0,
      firstInvalid: {
        sequence: 2n,
        reason: 'SEQUENCE_GAP',
      },
    });
  });

  it('reports PREVIOUS_HASH_MISMATCH if the very first record has a non-null previousHash', async () => {
    const chain = createValidAuditChain(3);
    const record1 = chain[0]!;
    record1.previousHash = 'forged_initial_hash_value';
    record1.hash = computeAuditHash({
      action: record1.action,
      actor: record1.actor,
      after: record1.after,
      before: record1.before,
      entity: record1.entity,
      entityId: record1.entityId,
      ip: record1.ip,
      occurredAt: record1.occurredAt,
      previousHash: record1.previousHash,
      requestId: record1.requestId,
      sequence: record1.sequence,
    });

    const reader = new InMemoryAuditChainReader(chain);
    const verifier = new AuditChainVerifier(reader);

    const result = await verifier.verify(2);

    expect(result).toEqual({
      valid: false,
      checked: 0,
      firstInvalid: {
        sequence: 1n,
        reason: 'PREVIOUS_HASH_MISMATCH',
      },
    });
  });

  it('stops immediately at the first invalid record when multiple corruptions exist', async () => {
    const chain = createValidAuditChain(5);
    // Corrompemos el registro 2
    chain[1]!.actor = 'corrupted_actor_2';
    // Y también corrompemos el registro 4
    chain[3]!.actor = 'corrupted_actor_4';

    const reader = new InMemoryAuditChainReader(chain);
    const verifier = new AuditChainVerifier(reader);

    const result = await verifier.verify(1);

    expect(result).toEqual({
      valid: false,
      checked: 1,
      firstInvalid: {
        sequence: 2n,
        reason: 'HASH_MISMATCH',
      },
    });
  });
});
