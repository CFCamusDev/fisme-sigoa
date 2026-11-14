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
    const listResponse = await request(app).get('/parameters');
    expect(listResponse.status).toBe(401);
  });

  it('mounts /response-scales router and rejects unauthenticated requests with 401 (HU-012, T-012-11)', async () => {
    const app = express();
    app.use(express.json());
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });
    app.use(errorHandler);

    const response = await request(app).post('/response-scales').send({});
    expect(response.status).toBe(401);
  });

  it('mounts /catalog-versions router and rejects unauthenticated requests with 401 (HU-013, T-013-13)', async () => {
    const app = express();
    app.use(express.json());
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });
    app.use(errorHandler);

    const response = await request(app).post('/catalog-versions').send({});
    expect(response.status).toBe(401);
  });

  it('mounts the catalog item edit routes and rejects unauthenticated requests with 401 (HU-014, T-014-06)', async () => {
    const app = express();
    app.use(express.json());
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });
    app.use(errorHandler);

    const response = await request(app)
      .put('/catalog-versions/v1/objectives')
      .send({ operation: 'REORDER', orderedIds: ['a'] });
    expect(response.status).toBe(401);
    const attributes = await request(app)
      .put('/catalog-versions/v1/attributes')
      .send({ operation: 'REORDER', orderedIds: ['a'] });
    expect(attributes.status).toBe(401);
  });

  it('mounts the compare route and rejects unauthenticated requests with 401 (HU-017, T-017-04)', async () => {
    const app = express();
    app.use(express.json());
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });
    app.use(errorHandler);

    const response = await request(app).get('/catalog-versions/v1/compare/v2');
    expect(response.status).toBe(401);
  });

  it('mounts the send to validation route and rejects unauthenticated requests with 401 (HU-015, T-015-03)', async () => {
    const app = express();
    app.use(express.json());
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });
    app.use(errorHandler);

    const response = await request(app).post('/catalog-versions/v1/validation').send({});
    expect(response.status).toBe(401);
  });

  it('mounts /resolutions router and rejects unauthenticated requests with 401 (HU-048, T-048-09)', async () => {
    const app = express();
    app.use(express.json());
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });
    app.use(errorHandler);

    const response = await request(app).post('/resolutions').send({});
    expect(response.status).toBe(401);
    const approval = await request(app).post('/resolutions/r1/approve').send();
    expect(approval.status).toBe(401);
    const listing = await request(app).get('/resolutions');
    expect(listing.status).toBe(401);
  });

  it('mounts /templates router and rejects unauthenticated requests with 401 (HU-018, T-018-14)', async () => {
    const app = express();
    app.use(express.json());
    setupAppRoutes(app, {
      unitOfWork: dummyUnitOfWork,
      auditLogger: dummyAuditLogger,
      dbProvider: dummyDbProvider,
      env: createTestEnv(),
    });
    app.use(errorHandler);

    const listing = await request(app).get('/templates');
    expect(listing.status).toBe(401);
    const detail = await request(app).get('/templates/t1');
    expect(detail.status).toBe(401);
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
