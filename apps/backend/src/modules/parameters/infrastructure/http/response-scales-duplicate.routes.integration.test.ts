import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { responseScaleDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('POST /response-scales/:id/duplicate HTTP Routes Integration (PostgreSQL real, HU-012, T-012-26, CA3, RF-012, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-response-scales-duplicate-test',
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
    await prisma.responseScale.create({
      data: {
        id: 'source_1',
        code: 'EVIDENCE_4',
        name: 'Evidencia 4',
        type: 'EVIDENCE',
        levels: {
          create: [
            { order: 1, label: 'No se evidencia', value: 1, countsAsAchievement: false },
            { order: 2, label: 'Se evidencia mayormente', value: 3, countsAsAchievement: true },
            { order: 3, label: 'Se evidencia totalmente', value: 4, countsAsAchievement: true },
          ],
        },
      },
    });
  });

  async function createActor(roles: string[]) {
    return createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });
  }

  const valid = { code: 'EVIDENCE_4_V2', name: 'Evidencia 4 (v2)' };
  const auditedCount = () => prisma.auditLog.count({ where: { entity: 'ResponseScale' } });

  describe('Success (201)', () => {
    it('copies type and levels into a new scale and audits the duplication', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/response-scales/source_1/duplicate')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(valid);

      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = responseScaleDtoSchema.parse(response.body);
      expect(body).toMatchObject({ code: 'EVIDENCE_4_V2', type: 'EVIDENCE', inUse: false });
      expect(body.id).not.toBe('source_1');
      expect(body.levels.map((l) => [l.order, l.label, l.value, l.countsAsAchievement])).toEqual([
        [1, 'No se evidencia', 1, false],
        [2, 'Se evidencia mayormente', 3, true],
        [3, 'Se evidencia totalmente', 4, true],
      ]);
      expect(await prisma.scaleLevel.count({ where: { scaleId: 'source_1' } })).toBe(3);

      const events = await prisma.auditLog.findMany({ where: { entity: 'ResponseScale' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ action: 'CREATE', actor: admin.user.id });
      expect(events[0]?.after).toMatchObject({ duplicatedFrom: 'EVIDENCE_4' });
    });

    it('duplicates a scale of two levels with none counting as achievement (incomplete but valid)', async () => {
      await prisma.responseScale.create({
        data: {
          id: 'small_1',
          code: 'PEQUENA',
          name: 'Pequeña',
          type: 'LIKERT',
          levels: {
            create: [
              { order: 1, label: 'Sí', value: 1, countsAsAchievement: false },
              { order: 2, label: 'No', value: 0, countsAsAchievement: false },
            ],
          },
        },
      });
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/response-scales/small_1/duplicate')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ code: 'PEQUENA_COPIA', name: 'Pequeña (copia)' });

      expect(response.status).toBe(201);
      expect(response.body.levels).toHaveLength(2);
    });
  });

  describe('Validation (400)', () => {
    const adminToken = async () => (await createActor(['ADMINISTRATOR'])).token;

    it.each([
      ['an extra field', { ...valid, extra: 1 }],
      ['an empty body', {}],
      ['a missing name', { code: valid.code }],
      ['a lowercase code', { ...valid, code: 'copia' }],
      ['an empty code', { ...valid, code: '' }],
      ['a 5000 character code', { ...valid, code: 'A'.repeat(5000) }],
      ['an empty name', { ...valid, name: '' }],
      ['a 121 character name', { ...valid, name: 'N'.repeat(121) }],
      ['levels in the body', { ...valid, levels: [] }],
    ])('answers 400 for %s without writing or auditing', async (_name, payload) => {
      const response = await request(app)
        .post('/response-scales/source_1/duplicate')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.responseScale.count()).toBe(1);
      expect(await auditedCount()).toBe(0);
    });

    it('answers 400 for a body that is not an object', async () => {
      const response = await request(app)
        .post('/response-scales/source_1/duplicate')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .send(['a']);
      expect(response.status).toBe(400);
    });

    it('answers 400 for an unknown query and for a 5000 character id', async () => {
      const token = await adminToken();

      const badQuery = await request(app)
        .post('/response-scales/source_1/duplicate?x=1')
        .set('Authorization', `Bearer ${token}`)
        .send(valid);
      const longId = await request(app)
        .post(`/response-scales/${'a'.repeat(5000)}/duplicate`)
        .set('Authorization', `Bearer ${token}`)
        .send(valid);

      expect(badQuery.status).toBe(400);
      expect(longId.status).toBe(400);
    });
  });

  describe('Not found (404) and conflict (409)', () => {
    it('answers 404 for a source that does not exist', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/response-scales/missing/duplicate')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(valid);

      expect(response.status).toBe(404);
      expect(await auditedCount()).toBe(0);
    });

    it('answers 409 when the code is already used', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/response-scales/source_1/duplicate')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ code: 'EVIDENCE_4', name: 'Otra' });

      expect(response.status).toBe(409);
      expect(await prisma.responseScale.count()).toBe(1);
      expect(await auditedCount()).toBe(0);
    });

    it('answers 409 to all but one of 4 simultaneous duplicates with the same code', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const responses = await Promise.all(
        Array.from({ length: 4 }, (_, index) =>
          request(app)
            .post('/response-scales/source_1/duplicate')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ code: 'EVIDENCE_4_V2', name: `Copia ${index}` }),
        ),
      );

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409]);
      expect(await prisma.responseScale.count({ where: { code: 'EVIDENCE_4_V2' } })).toBe(1);
      expect(await prisma.scaleLevel.count()).toBe(6);
      expect(await auditedCount()).toBe(1);
    }, 15_000);
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app).post('/response-scales/source_1/duplicate').send(valid);
      expect(response.status).toBe(401);
    });

    it.each([[[]], [['TEACHER']], [['COMMITTEE_MEMBER']]])(
      'answers 403 and audits ACCESS_DENIED for roles %j, who lack parametro.editar (RNF-009)',
      async (roles) => {
        const actor = await createActor(roles as string[]);

        const response = await request(app)
          .post('/response-scales/source_1/duplicate')
          .set('Authorization', `Bearer ${actor.token}`)
          .send(valid);

        expect(response.status).toBe(403);
        expect(await prisma.responseScale.count()).toBe(1);
        expect(await auditedCount()).toBe(0);
        const denied = await prisma.auditLog.findFirst({
          where: { action: 'ACCESS_DENIED', actor: actor.user.id },
        });
        expect(denied).not.toBeNull();
      },
    );
  });
});
