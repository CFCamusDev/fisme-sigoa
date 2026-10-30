import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupAppRoutes } from './routes.js';
import type { UnitOfWork } from './shared/unit-of-work/unit-of-work.js';
import type { AuditLogger } from './shared/audit/audit-logger.js';

describe('setupAppRoutes', () => {
  const dummyUnitOfWork: UnitOfWork = {
    run: async <T>(work: () => Promise<T>): Promise<T> => work(),
  };

  const dummyAuditLogger: AuditLogger = {
    log: async () => {},
  };

  it('mounts /auth router correctly on express app', async () => {
    const app = express();
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
    });

    const response = await request(app).get('/auth/unregistered');
    expect(response.status).toBe(404);
  });
});
