import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../errors/app-error.js';
import type { DbProvider } from './prisma-unit-of-work.js';
import {
  PrismaAuditLogger,
  type RequestAuditContext,
  type RequestContextProvider,
} from './prisma-audit-logger.js';

describe('PrismaAuditLogger (Unit)', () => {
  let mockAuditLogClient: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let mockClient: {
    $executeRaw: ReturnType<typeof vi.fn>;
    auditLog: typeof mockAuditLogClient;
  };
  let mockDbProvider: DbProvider;

  beforeEach(() => {
    mockAuditLogClient = {
      findFirst: vi.fn(),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'log-1', ...data })),
    };
    mockClient = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      auditLog: mockAuditLogClient,
    };
    mockDbProvider = {
      get: vi.fn().mockReturnValue(mockClient),
    };
  });

  it('inserts first record with sequence 1n and previousHash null when table is empty', async () => {
    mockAuditLogClient.findFirst.mockResolvedValue(null);

    const logger = new PrismaAuditLogger(mockDbProvider);

    await logger.log({
      action: 'CREATE',
      entity: 'EducationalObjective',
      entityId: 'oe-1',
      actor: 'user-1',
      before: null,
      after: { title: 'Objetivo 1' },
    });

    expect(mockClient.$executeRaw).toHaveBeenCalled();
    expect(mockAuditLogClient.findFirst).toHaveBeenCalledWith({
      orderBy: { sequence: 'desc' },
      select: { sequence: true, hash: true },
    });

    expect(mockAuditLogClient.create).toHaveBeenCalledTimes(1);
    const callArgs = mockAuditLogClient.create.mock.calls[0];
    expect(callArgs).toBeDefined();
    const createPayload = callArgs![0].data;

    expect(createPayload.sequence).toBe(1n);
    expect(createPayload.previousHash).toBeNull();
    expect(createPayload.actor).toBe('user-1');
    expect(createPayload.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('chains previousHash and increments sequence when previous record exists', async () => {
    const existingHash = 'e'.repeat(64);
    mockAuditLogClient.findFirst.mockResolvedValue({
      sequence: 5n,
      hash: existingHash,
    });

    const logger = new PrismaAuditLogger(mockDbProvider);

    await logger.log({
      action: 'UPDATE',
      entity: 'EducationalObjective',
      entityId: 'oe-1',
      actor: 'user-1',
      before: { title: 'Viejo' },
      after: { title: 'Nuevo' },
    });

    const callArgs = mockAuditLogClient.create.mock.calls[0];
    expect(callArgs).toBeDefined();
    const createPayload = callArgs![0].data;

    expect(createPayload.sequence).toBe(6n);
    expect(createPayload.previousHash).toBe(existingHash);
    expect(createPayload.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(createPayload.hash).not.toBe(existingHash);
  });

  it('throws ValidationError if no actor is provided in event or context', async () => {
    mockAuditLogClient.findFirst.mockResolvedValue(null);

    const logger = new PrismaAuditLogger(mockDbProvider);

    await expect(
      logger.log({
        action: 'CREATE',
        entity: 'EducationalObjective',
        entityId: 'oe-1',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('extracts actor, ip and requestId from context provider when not in event', async () => {
    mockAuditLogClient.findFirst.mockResolvedValue(null);

    const context: RequestAuditContext = {
      actor: 'context-user-id',
      ip: '200.10.20.30',
      requestId: 'uuid-req-123',
    };
    const mockContextProvider: RequestContextProvider = {
      get: vi.fn().mockReturnValue(context),
    };

    const logger = new PrismaAuditLogger(mockDbProvider, mockContextProvider);

    await logger.log({
      action: 'STATE_CHANGE',
      entity: 'EducationalObjective',
      entityId: 'oe-1',
    });

    const callArgs = mockAuditLogClient.create.mock.calls[0];
    expect(callArgs).toBeDefined();
    const createPayload = callArgs![0].data;

    expect(createPayload.actor).toBe('context-user-id');
    expect(createPayload.ip).toBe('200.10.20.30');
    expect(createPayload.requestId).toBe('uuid-req-123');
  });

  it('advances chain anchor with calculated sequence and hash when anchor is provided', async () => {
    mockAuditLogClient.findFirst.mockResolvedValue(null);

    const mockAnchor = {
      advance: vi.fn().mockResolvedValue(undefined),
      read: vi.fn(),
    };

    const logger = new PrismaAuditLogger(mockDbProvider, { get: () => undefined }, mockAnchor);

    await logger.log({
      action: 'CREATE',
      actor: 'user-with-anchor',
      entity: 'EducationalObjective',
      entityId: 'oe-anchor-1',
    });

    expect(mockAnchor.advance).toHaveBeenCalledTimes(1);
    const advanceArgs = mockAnchor.advance.mock.calls[0]![0];
    expect(advanceArgs.sequence).toBe(1n);
    expect(advanceArgs.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
