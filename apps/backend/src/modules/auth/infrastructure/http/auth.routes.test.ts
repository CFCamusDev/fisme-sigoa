import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAuthModule } from '../../index.js';
import type { UnitOfWork } from '../../../../shared/unit-of-work/unit-of-work.js';
import type { AuditLogger } from '../../../../shared/audit/audit-logger.js';

describe('AuthModule Router', () => {
  const dummyUnitOfWork: UnitOfWork = {
    run: async <T>(work: () => Promise<T>): Promise<T> => work(),
  };

  const dummyAuditLogger: AuditLogger = {
    log: async () => {},
  };

  it('mounts without errors and handles unregistered routes returning 404', async () => {
    const authRouter = createAuthModule({
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
    });

    const app = express();
    app.use('/auth', authRouter);

    const response = await request(app).get('/auth/unregistered');
    expect(response.status).toBe(404);
  });
});
