import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { catalogObjectivesResponseSchema, catalogVersionDetailDtoSchema } from '@sigoa/shared';
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

describe('PUT /catalog-versions/:id/objectives and GET /catalog-versions/:id (PostgreSQL real, HU-014, T-014-15, RF-014, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-catalog-objectives-test',
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

  async function setup() {
    const fixture = await createCatalogFixture(prisma);
    const draftId = await createDraftCatalogVersion(prisma, fixture);
    const member = await createActor(['COMMITTEE_MEMBER']);
    return { fixture, draftId, member };
  }

  const put = (token: string, versionId: string) =>
    request(app)
      .put(`/catalog-versions/${versionId}/objectives`)
      .set('Authorization', `Bearer ${token}`);

  const auditCount = (entity: string) => prisma.auditLog.count({ where: { entity } });

  describe('Success (200)', () => {
    it('updates the statement of an objective in a draft version and audits before and after', async () => {
      const { draftId, member } = await setup();
      const target = await prisma.educationalObjective.findFirstOrThrow({
        where: { versionId: draftId, code: 'OEP2' },
      });

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        id: target.id,
        code: 'OEP2',
        statement: 'Enunciado corregido del objetivo.',
      });

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = catalogObjectivesResponseSchema.parse(response.body);
      expect(body.items.map((item) => item.code)).toEqual(['OEP1', 'OEP2', 'OEP3', 'OEP4']);
      expect(body.items[1]?.statement).toBe('Enunciado corregido del objetivo.');

      const events = await prisma.auditLog.findMany({ where: { entity: 'EducationalObjective' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'UPDATE',
        entityId: target.id,
        actor: member.user.id,
      });
      expect(events[0]?.before).toMatchObject({ statement: 'Enunciado del objetivo 2.' });
      expect(events[0]?.after).toMatchObject({ statement: 'Enunciado corregido del objetivo.' });
    });

    it('adds an objective at the end of the list', async () => {
      const { draftId, member } = await setup();

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        code: 'OEP5',
        statement: 'x',
      });

      expect(response.status).toBe(200);
      const body = catalogObjectivesResponseSchema.parse(response.body);
      expect(body.items.at(-1)).toMatchObject({ code: 'OEP5', order: 5, statement: 'x' });
      const events = await prisma.auditLog.findMany({ where: { entity: 'EducationalObjective' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ action: 'CREATE', actor: member.user.id });
    });

    it('does not write or audit an edit without changes', async () => {
      const { draftId, member } = await setup();
      const target = await prisma.educationalObjective.findFirstOrThrow({
        where: { versionId: draftId, code: 'OEP1' },
      });

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        id: target.id,
        code: 'OEP1',
        statement: 'Enunciado del objetivo 1.',
      });

      expect(response.status).toBe(200);
      expect(await auditCount('EducationalObjective')).toBe(0);
    });

    it('reorders the objectives and audits the new order of codes', async () => {
      const { draftId, member } = await setup();
      const rows = await prisma.educationalObjective.findMany({
        where: { versionId: draftId },
        orderBy: { order: 'asc' },
      });

      const response = await put(member.token, draftId).send({
        operation: 'REORDER',
        orderedIds: [...rows].reverse().map((row) => row.id),
      });

      expect(response.status).toBe(200);
      const body = catalogObjectivesResponseSchema.parse(response.body);
      expect(body.items.map((item) => [item.code, item.order])).toEqual([
        ['OEP4', 1],
        ['OEP3', 2],
        ['OEP2', 3],
        ['OEP1', 4],
      ]);
      const events = await prisma.auditLog.findMany({ where: { entity: 'CatalogVersion' } });
      expect(events).toHaveLength(1);
      expect(events[0]?.after).toMatchObject({
        kind: 'OBJECTIVES',
        orderedCodes: ['OEP4', 'OEP3', 'OEP2', 'OEP1'],
      });
    });

    it('leaves the current version untouched', async () => {
      const { fixture, draftId, member } = await setup();

      await put(member.token, draftId).send({
        operation: 'SAVE',
        code: 'OEP9',
        statement: 'Nuevo.',
      });

      expect(
        await prisma.educationalObjective.count({
          where: { versionId: fixture.currentVersionId! },
        }),
      ).toBe(4);
    });
  });

  describe('Conflicts (409) and not found (404)', () => {
    it('answers 409 when the code already exists on create (CA2)', async () => {
      const { draftId, member } = await setup();

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        code: 'OEP2',
        statement: 'Repetido.',
      });

      expect(response.status).toBe(409);
      expect(await prisma.educationalObjective.count({ where: { versionId: draftId } })).toBe(4);
      expect(await auditCount('EducationalObjective')).toBe(0);
    });

    it('answers 409 when the code already exists on edit (CA2)', async () => {
      const { draftId, member } = await setup();
      const target = await prisma.educationalObjective.findFirstOrThrow({
        where: { versionId: draftId, code: 'OEP1' },
      });

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        id: target.id,
        code: 'OEP3',
        statement: 'Texto.',
      });

      expect(response.status).toBe(409);
    });

    it.each(['APPROVED', 'IN_VALIDATION'] as const)(
      'answers 409 for a version that is not a draft (%s) (CA3)',
      async (status) => {
        const { draftId, fixture, member } = await setup();
        const versionId = status === 'APPROVED' ? fixture.currentVersionId! : draftId;
        if (status === 'IN_VALIDATION') {
          await prisma.catalogVersion.update({ where: { id: draftId }, data: { status } });
        }

        const response = await put(member.token, versionId).send({
          operation: 'SAVE',
          code: 'OEP9',
          statement: 'Nuevo.',
        });

        expect(response.status).toBe(409);
        expect(await prisma.educationalObjective.count({ where: { code: 'OEP9' } })).toBe(0);
        expect(await auditCount('EducationalObjective')).toBe(0);
      },
    );

    it('answers 409 when the list to reorder is outdated', async () => {
      const { draftId, member } = await setup();
      const rows = await prisma.educationalObjective.findMany({ where: { versionId: draftId } });

      const response = await put(member.token, draftId).send({
        operation: 'REORDER',
        orderedIds: rows.slice(1).map((row) => row.id),
      });

      expect(response.status).toBe(409);
      expect(await auditCount('CatalogVersion')).toBe(0);
    });

    it('answers 409 when the maximum number of objectives is reached', async () => {
      const fixture = await createCatalogFixture(prisma);
      const draftId = await createDraftCatalogVersion(prisma, fixture, { objectiveCount: 100 });
      const member = await createActor(['COMMITTEE_MEMBER']);

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        code: 'OEP101',
        statement: 'Uno más.',
      });

      expect(response.status).toBe(409);
      expect(await prisma.educationalObjective.count({ where: { versionId: draftId } })).toBe(100);
    }, 20_000);

    it('answers 404 for a version that does not exist', async () => {
      const { member } = await setup();

      const response = await put(member.token, 'missing-version').send({
        operation: 'SAVE',
        code: 'OEP9',
        statement: 'Nuevo.',
      });

      expect(response.status).toBe(404);
    });

    it('answers 404 for an objective of another version', async () => {
      const { fixture, draftId, member } = await setup();
      const foreign = await prisma.educationalObjective.findFirstOrThrow({
        where: { versionId: fixture.currentVersionId! },
      });

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        id: foreign.id,
        code: 'OEP9',
        statement: 'Nuevo.',
      });

      expect(response.status).toBe(404);
      const untouched = await prisma.educationalObjective.findUniqueOrThrow({
        where: { id: foreign.id },
      });
      expect(untouched.code).toBe(foreign.code);
    });
  });

  describe('Concurrency', () => {
    it('creates exactly one objective when two requests add the same code at once', async () => {
      const { draftId, member } = await setup();

      const responses = await Promise.all(
        [1, 2].map(() =>
          put(member.token, draftId).send({
            operation: 'SAVE',
            code: 'OEP5',
            statement: 'Mismo código.',
          }),
        ),
      );

      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      expect(await prisma.educationalObjective.count({ where: { versionId: draftId } })).toBe(5);
      expect(await auditCount('EducationalObjective')).toBe(1);
    }, 20_000);
  });

  describe('Validation (400)', () => {
    it.each([
      ['an unknown operation', { operation: 'DELETE', code: 'OEP5', statement: 'x' }],
      ['a missing operation', { code: 'OEP5', statement: 'x' }],
      ['an extra field', { operation: 'SAVE', code: 'OEP5', statement: 'x', extra: 1 }],
      ['a name in an objective', { operation: 'SAVE', code: 'OEP5', statement: 'x', name: 'N' }],
      ['an invalid code', { operation: 'SAVE', code: 'oep 5', statement: 'x' }],
      ['an empty statement', { operation: 'SAVE', code: 'OEP5', statement: '   ' }],
      [
        'a statement of 2001 characters',
        { operation: 'SAVE', code: 'OEP5', statement: 'x'.repeat(2001) },
      ],
      ['an empty reorder list', { operation: 'REORDER', orderedIds: [] }],
      ['a repeated reorder list', { operation: 'REORDER', orderedIds: ['a', 'a'] }],
      [
        'a reorder list of 101 ids',
        {
          operation: 'REORDER',
          orderedIds: Array.from({ length: 101 }, (_, index) => `id-${index}`),
        },
      ],
    ])('answers 400 for %s without persisting or auditing', async (_name, payload) => {
      const { draftId, member } = await setup();

      const response = await put(member.token, draftId).send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.educationalObjective.count({ where: { versionId: draftId } })).toBe(4);
      expect(await auditCount('EducationalObjective')).toBe(0);
      expect(await auditCount('CatalogVersion')).toBe(0);
    });

    it('answers 400 for a version id longer than 64 characters', async () => {
      const { member } = await setup();

      const response = await put(member.token, 'x'.repeat(65)).send({
        operation: 'SAVE',
        code: 'OEP5',
        statement: 'x',
      });

      expect(response.status).toBe(400);
    });

    it('answers 400 for a query with unknown fields', async () => {
      const { draftId, member } = await setup();

      const response = await request(app)
        .put(`/catalog-versions/${draftId}/objectives?x=1`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({ operation: 'SAVE', code: 'OEP5', statement: 'x' });

      expect(response.status).toBe(400);
    });

    it('answers 400 for a body that is not JSON', async () => {
      const { draftId, member } = await setup();

      const response = await put(member.token, draftId)
        .set('Content-Type', 'application/json')
        .send('{not json');

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app)
        .put('/catalog-versions/v1/objectives')
        .send({ operation: 'REORDER', orderedIds: ['a'] });
      expect(response.status).toBe(401);
    });

    it.each([[[]], [['TEACHER']], [['ADMINISTRATOR']], [['PROGRAM_DIRECTOR']]])(
      'answers 403 and audits ACCESS_DENIED for roles %j, who lack catalogo.editar (RNF-009)',
      async (roles) => {
        const { draftId } = await setup();
        const actor = await createActor(roles as string[]);

        const response = await put(actor.token, draftId).send({
          operation: 'SAVE',
          code: 'OEP9',
          statement: 'Nuevo.',
        });

        expect(response.status).toBe(403);
        expect(await prisma.educationalObjective.count({ where: { code: 'OEP9' } })).toBe(0);
        expect(await auditCount('EducationalObjective')).toBe(0);
        const denied = await prisma.auditLog.findFirst({
          where: { action: 'ACCESS_DENIED', actor: actor.user.id },
        });
        expect(denied).not.toBeNull();
      },
    );
  });

  describe('GET /catalog-versions/:id', () => {
    it('returns the version with its objectives and attributes ordered', async () => {
      const { draftId, member } = await setup();

      const response = await request(app)
        .get(`/catalog-versions/${draftId}`)
        .set('Authorization', `Bearer ${member.token}`);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = catalogVersionDetailDtoSchema.parse(response.body);
      expect(body.version).toMatchObject({
        id: draftId,
        status: 'DRAFT',
        objectiveCount: 4,
        attributeCount: 12,
      });
      expect(body.objectives.map((item) => item.code)).toEqual(['OEP1', 'OEP2', 'OEP3', 'OEP4']);
      expect(body.attributes).toHaveLength(12);
      expect(JSON.stringify(body)).not.toContain('SEED');
    });

    it('lets a read-only role open the version', async () => {
      const { fixture } = await setup();
      const teacher = await createActor(['TEACHER']);

      const response = await request(app)
        .get(`/catalog-versions/${fixture.currentVersionId}`)
        .set('Authorization', `Bearer ${teacher.token}`);

      expect(response.status).toBe(200);
      expect(response.body.version.status).toBe('APPROVED');
    });

    it('answers 404 for a version that does not exist', async () => {
      const { member } = await setup();

      const response = await request(app)
        .get('/catalog-versions/missing')
        .set('Authorization', `Bearer ${member.token}`);

      expect(response.status).toBe(404);
    });

    it('answers 400 for a query with unknown fields', async () => {
      const { draftId, member } = await setup();

      const response = await request(app)
        .get(`/catalog-versions/${draftId}?x=1`)
        .set('Authorization', `Bearer ${member.token}`);

      expect(response.status).toBe(400);
    });

    it('answers 401 without token and 403 without catalogo.ver', async () => {
      const { draftId } = await setup();
      const actor = await createActor([]);

      expect((await request(app).get(`/catalog-versions/${draftId}`)).status).toBe(401);
      const forbidden = await request(app)
        .get(`/catalog-versions/${draftId}`)
        .set('Authorization', `Bearer ${actor.token}`);
      expect(forbidden.status).toBe(403);
      expect(
        await prisma.auditLog.findFirst({
          where: { action: 'ACCESS_DENIED', actor: actor.user.id },
        }),
      ).not.toBeNull();
    });
  });
});
