import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../../app.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { InMemoryAuditLogger } from '../../../../shared/audit/in-memory-audit-logger.js';
import { createReferenceModule } from '../../index.js';
import type { UnitOfWork } from '../../../../shared/unit-of-work/unit-of-work.js';

describe('ReferenceItem HTTP Routes (Supertest)', () => {
  const env = createTestEnv();
  const fakeUnitOfWork: UnitOfWork = {
    run: async (work) => await work(),
  };

  function buildTestApp(auditLogger = new InMemoryAuditLogger()) {
    const app = createApp({
      env,
      setupRoutes: (appInstance) => {
        appInstance.use(
          '/reference-items',
          createReferenceModule({
            unitOfWork: fakeUnitOfWork,
            auditLogger,
          }),
        );
      },
    });

    return { app, auditLogger };
  }

  it('POST /reference-items responds 201 with the dto and records audit event', async () => {
    const { app, auditLogger } = buildTestApp();

    const response = await request(app).post('/reference-items').send({
      code: 'REF-HTTP-1',
      title: 'Valid Reference Title',
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.code).toBe('REF-HTTP-1');
    expect(response.body.title).toBe('Valid Reference Title');
    expect(response.body.status).toBe('DRAFT');
    expect(response.body).toHaveProperty('createdAt');

    // Validación de evento de auditoría registrado
    expect(auditLogger.events).toHaveLength(1);
    expect(auditLogger.events[0]).toEqual({
      action: 'CREATE',
      entity: 'ReferenceItem',
      entityId: response.body.id,
      after: response.body,
    });
  });

  it('POST /reference-items responds 400 with details for invalid body', async () => {
    const { app, auditLogger } = buildTestApp();

    const response = await request(app).post('/reference-items').send({
      code: '',
      title: 'Valid Title',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toMatch(/validaci[oó]n/i);
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(response.body.error.details.length).toBeGreaterThan(0);
    expect(response.body.error.details[0].path).toBe('body.code');

    // Sin auditoría al fallar validación HTTP previa
    expect(auditLogger.events).toHaveLength(0);
  });

  it('POST /reference-items responds 409 for a duplicated code', async () => {
    const { app, auditLogger } = buildTestApp();

    // Primer registro exitoso
    const res1 = await request(app).post('/reference-items').send({
      code: 'REF-DUP-HTTP',
      title: 'First Item',
    });
    expect(res1.status).toBe(201);
    expect(auditLogger.events).toHaveLength(1);

    // Segundo registro con mismo código
    const res2 = await request(app).post('/reference-items').send({
      code: 'REF-DUP-HTTP',
      title: 'Second Item with same code',
    });

    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('CONFLICT');
    expect(res2.body.error.message).toContain('REF-DUP-HTTP');

    // No se agregó un segundo evento
    expect(auditLogger.events).toHaveLength(1);
  });
});
