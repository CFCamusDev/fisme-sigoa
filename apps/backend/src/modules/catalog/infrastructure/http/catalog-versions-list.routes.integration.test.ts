import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { listCatalogVersionsResponseSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createCatalogFixture } from '../../../../test/factories/catalog.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('GET /catalog-versions HTTP Routes Integration (PostgreSQL real, HU-013, T-013-22, RF-013, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-catalog-versions-list-test',
  });

  const emailSender = new InMemoryEmailSender();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);

  const app = createApp({
    env,
    setupRoutes: (instance) => {
      setupAppRoutes(instance, {
        unitOfWork: uow,
        auditLogger: auditServices.auditLogger,
        dbProvider: uow,
        env,
        emailSender,
      });
    },
  });

  beforeEach(async () => {
    emailSender.clear();
    await seedAuthorizationFast(prisma);
  });

  async function createActor(roles: string[]) {
    return createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });
  }

  it('lists the versions from the newest with their counts and without caching', async () => {
    const fixture = await createCatalogFixture(prisma);
    const draft = await prisma.catalogVersion.create({
      data: {
        programId: fixture.programId,
        number: 2,
        status: 'DRAFT',
        basedOnVersionId: fixture.currentVersionId,
      },
    });
    const teacher = await createActor(['TEACHER']);

    const response = await request(app)
      .get('/catalog-versions')
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = listCatalogVersionsResponseSchema.parse(response.body);
    expect(body.items.map((item) => [item.number, item.status])).toEqual([
      [2, 'DRAFT'],
      [1, 'APPROVED'],
    ]);
    expect(body.items[0]).toMatchObject({
      id: draft.id,
      basedOnVersionId: fixture.currentVersionId,
      objectiveCount: 0,
      attributeCount: 0,
    });
    expect(body.items[1]).toMatchObject({
      id: fixture.currentVersionId,
      basedOnVersionId: null,
      objectiveCount: 4,
      attributeCount: 12,
    });
  });

  it('answers an empty list for a program without versions (incomplete but valid)', async () => {
    await createCatalogFixture(prisma, { withCurrentVersion: false });
    const teacher = await createActor(['TEACHER']);

    const response = await request(app)
      .get('/catalog-versions')
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it('answers 404 when there is no program', async () => {
    const teacher = await createActor(['TEACHER']);

    const response = await request(app)
      .get('/catalog-versions')
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(response.status).toBe(404);
  });

  it.each(['page=0', 'pageSize=100000', 'foo=x', 'status=DRAFT'])(
    'answers 400 for the query %s',
    async (query) => {
      await createCatalogFixture(prisma);
      const teacher = await createActor(['TEACHER']);

      const response = await request(app)
        .get(`/catalog-versions?${query}`)
        .set('Authorization', `Bearer ${teacher.token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('answers 401 without token', async () => {
    const response = await request(app).get('/catalog-versions');
    expect(response.status).toBe(401);
  });

  it('answers 403 and audits ACCESS_DENIED for a user without catalogo.ver (RNF-009)', async () => {
    await createCatalogFixture(prisma);
    const actor = await createActor([]);

    const response = await request(app)
      .get('/catalog-versions')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(403);
    const denied = await prisma.auditLog.findFirst({
      where: { action: 'ACCESS_DENIED', actor: actor.user.id },
    });
    expect(denied).not.toBeNull();
  });
});
