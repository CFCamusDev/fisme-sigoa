import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, type AuditEvent, type AuditLogger } from './index.js';

describe('AuditLogger Port (RS-043, RNF-016)', () => {
  it('exposes all required audit action constants according to RS-043', () => {
    const expectedActions = [
      'CREATE',
      'UPDATE',
      'STATE_CHANGE',
      'VOID',
      'LOGIN_SUCCESS',
      'LOGIN_FAILURE',
      'ROLE_CHANGE',
      'PERMISSION_CHANGE',
      'PARAMETER_CHANGE',
      'DOWNLOAD',
      'PUBLIC_RESPONSE',
    ];

    expect(AUDIT_ACTIONS).toEqual(expectedActions);
  });

  it('allows implementing AuditLogger port in a mock class', async () => {
    const loggedEvents: AuditEvent[] = [];
    const mockLogger: AuditLogger = {
      async log(event: AuditEvent): Promise<void> {
        loggedEvents.push(event);
      },
    };

    const event: AuditEvent = {
      action: 'CREATE',
      entity: 'EducationalObjective',
      entityId: 'cuid-123',
      before: null,
      after: { code: 'OE01', description: 'Lograr competencias' },
      actor: 'user-456',
      ip: '192.168.1.1',
    };

    await mockLogger.log(event);

    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0]).toEqual(event);
  });
});
