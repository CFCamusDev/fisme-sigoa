import { describe, expect, it, vi } from 'vitest';
import type { AuditEvent, AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { AuditAccessDenialRecorder } from './audit-access-denial-recorder.js';

describe('AuditAccessDenialRecorder (RS-020, RS-043, RNF-016)', () => {
  function createSetup() {
    const events: AuditEvent[] = [];
    const auditLogger: AuditLogger = {
      log: vi.fn(async (event: AuditEvent) => {
        events.push(event);
      }),
    };
    let transactionsRun = 0;
    let shouldFailTransaction = false;
    const unitOfWork: UnitOfWork = {
      async run<T>(work: () => Promise<T>): Promise<T> {
        transactionsRun += 1;
        if (shouldFailTransaction) {
          throw new Error('DB write error');
        }
        return work();
      },
    };
    const logger = {
      error: vi.fn(),
    };

    const recorder = new AuditAccessDenialRecorder({
      unitOfWork,
      auditLogger,
      logger,
    });

    return {
      recorder,
      auditLogger,
      unitOfWork,
      logger,
      events,
      getTransactionsRun: () => transactionsRun,
      failNextTransaction: () => {
        shouldFailTransaction = true;
      },
    };
  }

  it('writes an ACCESS_DENIED audit event inside a unit of work transaction', async () => {
    const { recorder, events, getTransactionsRun } = createSetup();

    await recorder.record({
      actorId: 'actor-123',
      permission: 'usuario.crear',
      requiredScope: 'GLOBAL',
      grantedScope: null,
      reason: 'MISSING_PERMISSION',
      method: 'POST',
      route: '/users',
    });

    expect(getTransactionsRun()).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      action: 'ACCESS_DENIED',
      actor: 'actor-123',
      entity: 'Permission',
      entityId: 'usuario.crear',
      after: {
        reason: 'MISSING_PERMISSION',
        requiredScope: 'GLOBAL',
        grantedScope: null,
        method: 'POST',
        route: '/users',
      },
    });
  });

  it('truncates entityId to 100 characters and includes optional resourceType and resourceId when provided', async () => {
    const { recorder, events } = createSetup();
    const longPermission = 'a'.repeat(140);

    await recorder.record({
      actorId: 'actor-456',
      permission: longPermission,
      requiredScope: 'OWN',
      grantedScope: 'OWN',
      reason: 'NOT_OWNER',
      method: 'GET',
      route: '/courses/:id/measurements',
      resourceType: 'CourseMeasurement',
      resourceId: 'cm-999',
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.entityId).toHaveLength(100);
    expect(events[0]?.entityId).toBe('a'.repeat(100));
    expect(events[0]?.after).toEqual({
      reason: 'NOT_OWNER',
      requiredScope: 'OWN',
      grantedScope: 'OWN',
      method: 'GET',
      route: '/courses/:id/measurements',
      resourceType: 'CourseMeasurement',
      resourceId: 'cm-999',
    });
  });

  it('defaults method and route to USE_CASE when not provided by HTTP middleware', async () => {
    const { recorder, events } = createSetup();

    await recorder.record({
      actorId: 'actor-789',
      permission: 'rol.editar',
      requiredScope: 'GLOBAL',
      grantedScope: 'OWN',
      reason: 'SCOPE_INSUFFICIENT',
    });

    expect(events[0]?.after).toEqual({
      reason: 'SCOPE_INSUFFICIENT',
      requiredScope: 'GLOBAL',
      grantedScope: 'OWN',
      method: 'USE_CASE',
      route: 'USE_CASE',
    });
  });

  it('logs the failure via logger without throwing when the audit transaction fails (D4)', async () => {
    const { recorder, failNextTransaction, logger } = createSetup();
    failNextTransaction();

    await expect(
      recorder.record({
        actorId: 'actor-err',
        permission: 'usuario.ver',
        requiredScope: 'GLOBAL',
        grantedScope: null,
        reason: 'MISSING_PERMISSION',
        method: 'GET',
        route: '/users',
      }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
