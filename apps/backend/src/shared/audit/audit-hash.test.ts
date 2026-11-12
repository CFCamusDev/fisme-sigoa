import { describe, expect, it } from 'vitest';
import { canonicalizeJson, computeAuditHash, type AuditHashPayload } from './audit-hash.js';

describe('Audit Hash Calculation (RS-041, RS-042, RNF-015)', () => {
  const basePayload: AuditHashPayload = {
    sequence: 1n,
    occurredAt: new Date('2026-10-26T12:00:00.000Z'),
    actor: 'user-cuid-1',
    ip: '192.168.1.100',
    requestId: 'req-uuid-1',
    action: 'CREATE',
    entity: 'EducationalObjective',
    entityId: 'oe-cuid-1',
    before: null,
    after: { code: 'OE01', title: 'Competencias profesionales', active: true },
    previousHash: null,
  };

  it('produces a 64-character lowercase hexadecimal SHA-256 hash', () => {
    const hash = computeAuditHash(basePayload);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic: produces the exact same hash for identical inputs', () => {
    const hashA = computeAuditHash(basePayload);
    const hashB = computeAuditHash({ ...basePayload });
    expect(hashA).toBe(hashB);
  });

  it('is canonical: produces the same hash regardless of object key order in payloads', () => {
    const payloadReordered: AuditHashPayload = {
      ...basePayload,
      after: { active: true, title: 'Competencias profesionales', code: 'OE01' },
    };

    const hashA = computeAuditHash(basePayload);
    const hashB = computeAuditHash(payloadReordered);
    expect(hashA).toBe(hashB);
  });

  it('canonicalizes nested objects and arrays recursively', () => {
    const nestedA = { b: 2, a: { y: 20, x: 10 }, arr: [{ z: 1, y: 0 }] };
    const nestedB = { a: { x: 10, y: 20 }, b: 2, arr: [{ y: 0, z: 1 }] };

    expect(canonicalizeJson(nestedA)).toBe(canonicalizeJson(nestedB));
  });

  it('changes the hash if previousHash changes', () => {
    const hashA = computeAuditHash(basePayload);
    const hashB = computeAuditHash({
      ...basePayload,
      previousHash: 'a'.repeat(64),
    });
    expect(hashA).not.toBe(hashB);
  });

  it('changes the hash if occurredAt changes', () => {
    const hashA = computeAuditHash(basePayload);
    const hashB = computeAuditHash({
      ...basePayload,
      occurredAt: new Date('2026-10-26T12:00:01.000Z'),
    });
    expect(hashA).not.toBe(hashB);
  });

  it('changes the hash if sequence changes', () => {
    const hashA = computeAuditHash(basePayload);
    const hashB = computeAuditHash({
      ...basePayload,
      sequence: 2n,
    });
    expect(hashA).not.toBe(hashB);
  });

  it('changes the hash if any content field changes', () => {
    const hashA = computeAuditHash(basePayload);
    const hashB = computeAuditHash({
      ...basePayload,
      entityId: 'oe-cuid-2',
    });
    expect(hashA).not.toBe(hashB);
  });

  it('propagates changes in record 1 to record 2 hash via previousHash (RS-042, RNF-015)', () => {
    const record1Initial = computeAuditHash(basePayload);
    const record2Payload: AuditHashPayload = {
      action: 'UPDATE',
      actor: 'user-2',
      after: { active: false },
      before: { active: true },
      entity: 'EducationalObjective',
      entityId: 'oe-cuid-1',
      occurredAt: new Date('2026-10-26T12:05:00.000Z'),
      previousHash: record1Initial,
      sequence: 2n,
    };
    const record2HashInitial = computeAuditHash(record2Payload);

    // Si alteramos el contenido del registro 1, su hash cambia
    const record1Tampered = computeAuditHash({
      ...basePayload,
      actor: 'attacker',
    });
    expect(record1Tampered).not.toBe(record1Initial);

    // Al encadenar en el registro 2 el hash alterado, su hash resultante cambia
    const record2HashWithTamperedPrevious = computeAuditHash({
      ...record2Payload,
      previousHash: record1Tampered,
    });
    expect(record2HashWithTamperedPrevious).not.toBe(record2HashInitial);
  });
});
