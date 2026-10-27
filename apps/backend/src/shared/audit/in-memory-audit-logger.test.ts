import { describe, expect, it } from 'vitest';
import type { AuditEvent } from './audit-logger.js';
import { InMemoryAuditLogger } from './in-memory-audit-logger.js';

describe('InMemoryAuditLogger (Unit, RS-043, RNF-016)', () => {
  it('records an audit event and exposes it in the events list', async () => {
    const logger = new InMemoryAuditLogger();

    const event: AuditEvent = {
      action: 'CREATE',
      entity: 'ReferenceItem',
      entityId: 'item-123',
      actor: 'test-user',
      after: { name: 'Item Name' },
    };

    await logger.log(event);

    expect(logger.events).toHaveLength(1);
    expect(logger.events[0]).toEqual(event);
  });

  it('records multiple events in order', async () => {
    const logger = new InMemoryAuditLogger();

    await logger.log({
      action: 'CREATE',
      entity: 'EducationalObjective',
      entityId: 'oe-1',
    });

    await logger.log({
      action: 'UPDATE',
      entity: 'EducationalObjective',
      entityId: 'oe-1',
      before: { title: 'Old' },
      after: { title: 'New' },
    });

    expect(logger.events).toHaveLength(2);
    expect(logger.events[0]?.action).toBe('CREATE');
    expect(logger.events[1]?.action).toBe('UPDATE');
  });

  it('stores defensive copies so external mutations do not affect recorded events', async () => {
    const logger = new InMemoryAuditLogger();
    const payload = { title: 'Original' };

    await logger.log({
      action: 'CREATE',
      entity: 'ReferenceItem',
      entityId: 'item-1',
      after: payload,
    });

    payload.title = 'Mutated';

    expect(logger.events[0]?.after).toEqual({ title: 'Original' });
  });

  it('allows clearing recorded events', async () => {
    const logger = new InMemoryAuditLogger();

    await logger.log({
      action: 'VOID',
      entity: 'ReferenceItem',
      entityId: 'item-1',
    });

    expect(logger.events).toHaveLength(1);

    logger.clear();

    expect(logger.events).toHaveLength(0);
  });

  it('allows simulating failures when configured', async () => {
    const logger = new InMemoryAuditLogger();
    logger.simulateFailure = new Error('Simulated audit failure');

    await expect(
      logger.log({
        action: 'CREATE',
        entity: 'ReferenceItem',
        entityId: 'item-fail',
      }),
    ).rejects.toThrow('Simulated audit failure');

    // No debe haber guardado el evento si falló
    expect(logger.events).toHaveLength(0);
  });
});
