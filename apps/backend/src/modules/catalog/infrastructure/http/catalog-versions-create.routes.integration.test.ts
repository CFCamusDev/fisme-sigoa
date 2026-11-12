import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { catalogVersionDtoSchema } from '@sigoa/shared';
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

describe('POST /catalog-versions HTTP Routes Integration (PostgreSQL real, HU-013, T-013-22, RF-013, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-catalog-versions-create-test',
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

  const auditedCount = () => prisma.auditLog.count({ where: { entity: 'CatalogVersion' } });

  describe('Success (201)', () => {
    it('creates a draft copy of the current version and audits it (CA1)', async () => {
      const fixture = await createCatalogFixture(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await request(app)
        .post('/catalog-versions')
        .set('Authorization', `Bearer ${president.token}`)
        .send({});

      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = catalogVersionDtoSchema.parse(response.body);
      expect(body).toMatchObject({
        programId: fixture.programId,
        number: 2,
        status: 'DRAFT',
        basedOnVersionId: fixture.currentVersionId,
        objectiveCount: 4,
        attributeCount: 12,
      });

      const copiedObjectives = await prisma.educationalObjective.findMany({
        where: { versionId: body.id },
        orderBy: { order: 'asc' },
      });
      expect(copiedObjectives.map((item) => item.code)).toEqual(['OEP1', 'OEP2', 'OEP3', 'OEP4']);
      expect(await prisma.graduateAttribute.count({ where: { versionId: body.id } })).toBe(12);
      // La vigente no se toca
      expect(
        await prisma.educationalObjective.count({
          where: { versionId: fixture.currentVersionId! },
        }),
      ).toBe(4);
      expect(
        (
          await prisma.catalogVersion.findUniqueOrThrow({
            where: { id: fixture.currentVersionId! },
          })
        ).status,
      ).toBe('APPROVED');

      const events = await prisma.auditLog.findMany({ where: { entity: 'CatalogVersion' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'CREATE',
        entityId: body.id,
        actor: president.user.id,
      });
      expect(events[0]?.before).toBeNull();
      expect(events[0]?.after).toMatchObject({
        number: 2,
        status: 'DRAFT',
        copiedObjectives: 4,
        copiedAttributes: 12,
      });
    });

    it('accepts an absent body (incomplete but valid)', async () => {
      await createCatalogFixture(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await request(app)
        .post('/catalog-versions')
        .set('Authorization', `Bearer ${president.token}`);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ number: 2, status: 'DRAFT' });
    });

    it('creates an empty draft without source when there is no current version', async () => {
      await createCatalogFixture(prisma, { withCurrentVersion: false });
      const member = await createActor(['COMMITTEE_MEMBER']);

      const response = await request(app)
        .post('/catalog-versions')
        .set('Authorization', `Bearer ${member.token}`)
        .send({});

      expect(response.status).toBe(201);
      expect(catalogVersionDtoSchema.parse(response.body)).toMatchObject({
        number: 1,
        status: 'DRAFT',
        basedOnVersionId: null,
        objectiveCount: 0,
        attributeCount: 0,
      });
    });

    it('numbers the draft after the highest version', async () => {
      const fixture = await createCatalogFixture(prisma);
      await prisma.catalogVersion.update({
        where: { id: fixture.currentVersionId! },
        data: { number: 5 },
      });
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await request(app)
        .post('/catalog-versions')
        .set('Authorization', `Bearer ${president.token}`)
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.number).toBe(6);
    });
  });

  describe('Conflict and missing program (409, 404)', () => {
    it.each(['DRAFT', 'IN_VALIDATION'] as const)(
      'answers 409 when an open version exists (%s) and creates nothing (CA2)',
      async (status) => {
        const fixture = await createCatalogFixture(prisma);
        await prisma.catalogVersion.create({
          data: { programId: fixture.programId, number: 2, status },
        });
        const president = await createActor(['COMMITTEE_PRESIDENT']);

        const response = await request(app)
          .post('/catalog-versions')
          .set('Authorization', `Bearer ${president.token}`)
          .send({});

        expect(response.status).toBe(409);
        expect(response.body.error.message).toContain('Borrador o En validación');
        expect(await prisma.catalogVersion.count()).toBe(2);
        expect(await auditedCount()).toBe(0);
      },
    );

    it('answers 404 when there is no program', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await request(app)
        .post('/catalog-versions')
        .set('Authorization', `Bearer ${president.token}`)
        .send({});

      expect(response.status).toBe(404);
      expect(await auditedCount()).toBe(0);
    });

    it('creates exactly one draft under concurrent requests', async () => {
      await createCatalogFixture(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app)
            .post('/catalog-versions')
            .set('Authorization', `Bearer ${president.token}`)
            .send({}),
        ),
      );

      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      expect(
        await prisma.catalogVersion.count({
          where: { status: { in: ['DRAFT', 'IN_VALIDATION'] } },
        }),
      ).toBe(1);
      expect(await prisma.catalogVersion.count()).toBe(2);
      expect(await auditedCount()).toBe(1);
      const draft = await prisma.catalogVersion.findFirstOrThrow({ where: { status: 'DRAFT' } });
      expect(await prisma.educationalObjective.count({ where: { versionId: draft.id } })).toBe(4);
      expect(await prisma.graduateAttribute.count({ where: { versionId: draft.id } })).toBe(12);
    }, 15_000);
  });

  describe('Validation (400)', () => {
    it.each([
      ['an extra field', { programId: 'p1' }],
      ['a source version', { basedOnVersionId: 'v1' }],
      ['a string body', 'texto'],
      ['an array body', [1]],
    ])('answers 400 for %s without persisting or auditing', async (_name, payload) => {
      await createCatalogFixture(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await request(app)
        .post('/catalog-versions')
        .set('Authorization', `Bearer ${president.token}`)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.catalogVersion.count()).toBe(1);
      expect(await auditedCount()).toBe(0);
    });

    it('answers 400 for a query with unknown fields', async () => {
      await createCatalogFixture(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await request(app)
        .post('/catalog-versions?x=1')
        .set('Authorization', `Bearer ${president.token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(await prisma.catalogVersion.count()).toBe(1);
    });

    it('answers 400 for a body that is not JSON', async () => {
      await createCatalogFixture(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await request(app)
        .post('/catalog-versions')
        .set('Authorization', `Bearer ${president.token}`)
        .set('Content-Type', 'application/json')
        .send('{not json');

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app).post('/catalog-versions').send({});
      expect(response.status).toBe(401);
    });

    it.each([[[]], [['TEACHER']], [['ADMINISTRATOR']], [['PROGRAM_DIRECTOR']]])(
      'answers 403 and audits ACCESS_DENIED for roles %j, who lack catalogo.editar (RNF-009)',
      async (roles) => {
        await createCatalogFixture(prisma);
        const actor = await createActor(roles as string[]);

        const response = await request(app)
          .post('/catalog-versions')
          .set('Authorization', `Bearer ${actor.token}`)
          .send({});

        expect(response.status).toBe(403);
        expect(await prisma.catalogVersion.count()).toBe(1);
        expect(await auditedCount()).toBe(0);
        const denied = await prisma.auditLog.findFirst({
          where: { action: 'ACCESS_DENIED', actor: actor.user.id },
        });
        expect(denied).not.toBeNull();
      },
    );
  });
});
