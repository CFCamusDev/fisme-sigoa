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
import {
  createCatalogFixture,
  createDraftCatalogVersion,
} from '../../../../test/factories/catalog.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('POST /catalog-versions/:id/validation (PostgreSQL real, HU-015, T-015-08, RF-015, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-catalog-validation-test',
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

  async function setup(options: Parameters<typeof createDraftCatalogVersion>[2] = {}) {
    const fixture = await createCatalogFixture(prisma);
    const draftId = await createDraftCatalogVersion(prisma, fixture, options);
    const member = await createActor(['COMMITTEE_MEMBER']);
    return { fixture, draftId, member };
  }

  const post = (token: string, versionId: string) =>
    request(app)
      .post(`/catalog-versions/${versionId}/validation`)
      .set('Authorization', `Bearer ${token}`);

  const auditCount = () => prisma.auditLog.count({ where: { entity: 'CatalogVersion' } });

  describe('Success (200)', () => {
    it('sends a complete draft to validation and exposes it as the open version', async () => {
      const { draftId, fixture, member } = await setup();

      const response = await post(member.token, draftId).send({});

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = catalogVersionDtoSchema.parse(response.body);
      expect(body).toMatchObject({
        id: draftId,
        status: 'IN_VALIDATION',
        objectiveCount: 4,
        attributeCount: 12,
      });
      const row = await prisma.catalogVersion.findUniqueOrThrow({ where: { id: draftId } });
      expect(row.status).toBe('IN_VALIDATION');
      expect(row.updatedBy).toBe(member.user.id);
      const open = await prisma.catalogVersion.findFirstOrThrow({
        where: { programId: fixture.programId, status: { in: ['DRAFT', 'IN_VALIDATION'] } },
      });
      expect(open.id).toBe(draftId);
      const events = await prisma.auditLog.findMany({ where: { entity: 'CatalogVersion' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'STATE_CHANGE',
        entityId: draftId,
        actor: member.user.id,
      });
      expect(events[0]?.before).toMatchObject({ status: 'DRAFT' });
      expect(events[0]?.after).toMatchObject({ status: 'IN_VALIDATION' });
    });

    it('accepts an absent body (incomplete but valid)', async () => {
      const { draftId, member } = await setup();

      const response = await post(member.token, draftId);

      expect(response.status).toBe(200);
      expect(catalogVersionDtoSchema.parse(response.body).status).toBe('IN_VALIDATION');
    });
  });

  describe('Conflicts (409) and not found (404)', () => {
    it('answers 409 with the unmet precondition when the version has no attributes (CA2)', async () => {
      const { draftId, member } = await setup({ attributeCount: 0 });

      const response = await post(member.token, draftId).send({});

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/atributo del graduado/);
      const row = await prisma.catalogVersion.findUniqueOrThrow({ where: { id: draftId } });
      expect(row.status).toBe('DRAFT');
      expect(await auditCount()).toBe(0);
    });

    it('answers 409 when the version has no objectives (CA2)', async () => {
      const { draftId, member } = await setup({ objectiveCount: 0 });

      const response = await post(member.token, draftId).send({});

      expect(response.status).toBe(409);
      expect(await auditCount()).toBe(0);
    });

    it.each(['IN_VALIDATION', 'APPROVED'] as const)(
      'answers 409 for a version that is not a draft (%s)',
      async (status) => {
        const { draftId, fixture, member } = await setup();
        const versionId = status === 'APPROVED' ? fixture.currentVersionId! : draftId;
        if (status === 'IN_VALIDATION') {
          await prisma.catalogVersion.update({ where: { id: draftId }, data: { status } });
        }

        const response = await post(member.token, versionId).send({});

        expect(response.status).toBe(409);
        const row = await prisma.catalogVersion.findUniqueOrThrow({ where: { id: versionId } });
        expect(row.status).toBe(status);
        expect(await auditCount()).toBe(0);
      },
    );

    it('answers 404 for a version that does not exist', async () => {
      const { member } = await setup();

      const response = await post(member.token, 'missing-version').send({});

      expect(response.status).toBe(404);
      expect(await auditCount()).toBe(0);
    });
  });

  describe('Validation (400)', () => {
    it.each([
      ['an extra field', { status: 'APPROVED' }],
      ['a non-object body', [1]],
    ])('answers 400 for %s without changing the version', async (_name, payload) => {
      const { draftId, member } = await setup();

      const response = await post(member.token, draftId).send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      const row = await prisma.catalogVersion.findUniqueOrThrow({ where: { id: draftId } });
      expect(row.status).toBe('DRAFT');
      expect(await auditCount()).toBe(0);
    });

    it('answers 400 for a version id longer than 64 characters', async () => {
      const { member } = await setup();

      const response = await post(member.token, 'x'.repeat(65)).send({});

      expect(response.status).toBe(400);
    });

    it('answers 400 for a query with unknown fields', async () => {
      const { draftId, member } = await setup();

      const response = await request(app)
        .post(`/catalog-versions/${draftId}/validation?x=1`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(await auditCount()).toBe(0);
    });
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app).post('/catalog-versions/v1/validation').send({});
      expect(response.status).toBe(401);
    });

    it.each([[[]], [['TEACHER']], [['ADMINISTRATOR']], [['PROGRAM_DIRECTOR']]])(
      'answers 403 and audits ACCESS_DENIED for roles %j, who lack catalogo.editar (RNF-009)',
      async (roles) => {
        const { draftId } = await setup();
        const actor = await createActor(roles as string[]);

        const response = await post(actor.token, draftId).send({});

        expect(response.status).toBe(403);
        const row = await prisma.catalogVersion.findUniqueOrThrow({ where: { id: draftId } });
        expect(row.status).toBe('DRAFT');
        expect(await auditCount()).toBe(0);
        const denied = await prisma.auditLog.findFirst({
          where: { action: 'ACCESS_DENIED', actor: actor.user.id },
        });
        expect(denied).not.toBeNull();
      },
    );
  });

  describe('Concurrency', () => {
    it('lets exactly one of two simultaneous requests send the draft', async () => {
      const { draftId, member } = await setup();

      const responses = await Promise.all([1, 2].map(() => post(member.token, draftId).send({})));

      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      expect(await auditCount()).toBe(1);
    }, 20_000);
  });
});
