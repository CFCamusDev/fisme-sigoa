import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupAppRoutes } from './routes.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import type { UnitOfWork } from './shared/unit-of-work/unit-of-work.js';
import type { AuditLogger } from './shared/audit/audit-logger.js';
import type { DbProvider } from './shared/prisma/prisma-unit-of-work.js';
import { createTestEnv } from './test/test-env.js';

describe('setupAppRoutes', () => {
  const dummyUnitOfWork: UnitOfWork = {
    run: async <T>(work: () => Promise<T>): Promise<T> => work(),
  };

  const dummyAuditLogger: AuditLogger = {
    log: async () => {},
  };

  const dummyDbProvider: DbProvider = {
    get: () => ({}) as unknown as ReturnType<DbProvider['get']>,
    isInTransaction: () => false,
  };

  it('mounts /auth router correctly on express app', async () => {
    const app = express();
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });

    const response = await request(app).get('/auth/unregistered');
    expect(response.status).toBe(404);
  });

  it('mounts /users router and rejects unauthenticated requests with 401', async () => {
    const app = express();
    app.use(express.json());
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });
    app.use(errorHandler);

    const response = await request(app).post('/users').send({
      email: 'test@unterm.edu.pe',
    });
    expect(response.status).toBe(401);
  });

  it('mounts /semesters router and rejects unauthenticated requests with 401 (HU-010, T-010-08)', async () => {
    const app = express();
    app.use(express.json());
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });
    app.use(errorHandler);

    const response = await request(app).get('/semesters');
    expect(response.status).toBe(401);
  });

  it('mounts /parameters router and rejects unauthenticated requests with 401 (HU-011, T-011-09)', async () => {
    const app = express();
    app.use(express.json());
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });
    app.use(errorHandler);

    const response = await request(app).post('/parameters').send({});
    expect(response.status).toBe(401);
  });

  it('throws an error in production if APP_PUBLIC_URL is not configured', () => {
    const app = express();
    const prodEnv = createTestEnv({
      NODE_ENV: 'production',
      APP_PUBLIC_URL: undefined as unknown as string,
    });
    delete (prodEnv as Record<string, unknown>).APP_PUBLIC_URL;

    expect(() => {
      setupAppRoutes(app, {
        unitOfWork: dummyUnitOfWork,
        auditLogger: dummyAuditLogger,
        dbProvider: dummyDbProvider,
        env: prodEnv,
      });
    }).toThrow(/APP_PUBLIC_URL es obligatorio/);
  });
});
