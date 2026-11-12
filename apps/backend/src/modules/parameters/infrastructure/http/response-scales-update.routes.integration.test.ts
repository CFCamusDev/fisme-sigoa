import { beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { responseScaleDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createResponseScalesModule } from '../../index.js';

describe('PATCH /response-scales/:id HTTP Routes Integration (PostgreSQL real, HU-012, T-012-25, CA3, RF-012, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-response-scales-update-test',
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
        id: 'scale_1',
        code: 'LIKERT_5',
        name: 'Likert 5',
        type: 'LIKERT',
        levels: {
          create: [
            { order: 1, label: 'Bajo', value: 1, countsAsAchievement: false },
            { order: 2, label: 'Medio', value: 2, countsAsAchievement: false },
            { order: 3, label: 'Alto', value: 3, countsAsAchievement: true },
          ],
        },
      },
    });
  });

  async function createActor(roles: string[]) {
    return createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });
  }

  const level = (label: string, value: number, countsAsAchievement = false) => ({
    label,
    value,
    countsAsAchievement,
  });

  const auditedCount = () => prisma.auditLog.count({ where: { entity: 'ResponseScale' } });
  const currentName = async () =>
    (await prisma.responseScale.findUniqueOrThrow({ where: { id: 'scale_1' } })).name;

  describe('Success (200)', () => {
    it('replaces the name and the levels and audits before and after', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .patch('/response-scales/scale_1')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Likert 2', levels: [level('No', 0), level('Sí', 100, true)] });

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = responseScaleDtoSchema.parse(response.body);
      expect(body).toMatchObject({
        id: 'scale_1',
        code: 'LIKERT_5',
        name: 'Likert 2',
        inUse: false,
      });
      expect(body.levels.map((l) => [l.order, l.label, l.value, l.countsAsAchievement])).toEqual([
        [1, 'No', 0, false],
        [2, 'Sí', 100, true],
      ]);

      const events = await prisma.auditLog.findMany({ where: { entity: 'ResponseScale' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'UPDATE',
        entityId: 'scale_1',
        actor: admin.user.id,
      });
      expect((events[0]?.before as { levels: unknown[] }).levels).toHaveLength(3);
      expect((events[0]?.after as { levels: unknown[] }).levels).toHaveLength(2);
    });

    it('changes only the name when levels are not sent (incomplete but valid)', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .patch('/response-scales/scale_1')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Solo nombre' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Solo nombre');
      expect(response.body.levels).toHaveLength(3);
      expect(await prisma.scaleLevel.count({ where: { scaleId: 'scale_1' } })).toBe(3);
    });

    it('changes only the levels when the name is not sent', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .patch('/response-scales/scale_1')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ levels: [level('A', 1), level('B', 2, true)] });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Likert 5');
      expect(response.body.levels).toHaveLength(2);
    });

    it('answers 200 without writing or auditing when the values are the same', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .patch('/response-scales/scale_1')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Likert 5' });

      expect(response.status).toBe(200);
      expect(await auditedCount()).toBe(0);
    });
  });

  describe('Validation (400)', () => {
    const adminToken = async () => (await createActor(['ADMINISTRATOR'])).token;

    it.each([
      ['an empty body', {}],
      ['a code in the body', { name: 'X', code: 'OTRO_CODIGO' }],
      ['a type in the body', { name: 'X', type: 'EVIDENCE' }],
      ['an extra field', { name: 'X', extra: 1 }],
      ['an empty name', { name: '' }],
      ['a 121 character name', { name: 'N'.repeat(121) }],
      ['one level', { levels: [level('Solo', 1)] }],
      [
        'eleven levels',
        { levels: Array.from({ length: 11 }, (_, index) => level(`Nivel ${index}`, index)) },
      ],
      ['a decimal value', { levels: [level('A', 13.5), level('B', 2)] }],
      ['a negative value', { levels: [level('A', -1), level('B', 2)] }],
      ['a value above 100', { levels: [level('A', 101), level('B', 2)] }],
      ['repeated values', { levels: [level('A', 1), level('B', 1)] }],
      ['repeated labels ignoring case', { levels: [level('Alto', 1), level('ALTO', 2)] }],
      ['a missing flag', { levels: [{ label: 'A', value: 1 }, level('B', 2)] }],
    ])('answers 400 for %s and leaves the scale untouched', async (_name, payload) => {
      const response = await request(app)
        .patch('/response-scales/scale_1')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await currentName()).toBe('Likert 5');
      expect(await prisma.scaleLevel.count({ where: { scaleId: 'scale_1' } })).toBe(3);
      expect(await auditedCount()).toBe(0);
    });

    it('answers 400 for a 5000 character id and for an unknown query', async () => {
      const token = await adminToken();

      const longId = await request(app)
        .patch(`/response-scales/${'a'.repeat(5000)}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X' });
      const badQuery = await request(app)
        .patch('/response-scales/scale_1?x=1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X' });

      expect(longId.status).toBe(400);
      expect(badQuery.status).toBe(400);
    });
  });

  describe('Not found (404)', () => {
    it('answers 404 for an id that does not exist', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .patch('/response-scales/missing')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'X' });

      expect(response.status).toBe(404);
      expect(await auditedCount()).toBe(0);
    });
  });

  describe('Conflict (409), scale in use (CA3)', () => {
    it('answers 409 proposing to duplicate and leaves the scale intact', async () => {
      const inUseApp = express();
      inUseApp.use(express.json());
      inUseApp.use(
        '/response-scales',
        createResponseScalesModule({
          unitOfWork: uow,
          auditLogger: auditServices.auditLogger,
          dbProvider: uow,
          authenticate: (req, _res, next) => {
            (req as unknown as { user: { id: string } }).user = { id: 'admin_1' };
            next();
          },
          requirePermission: () => (_req, _res, next) => next(),
          permissionChecker: { assertAllowed: async () => {} },
          scaleUsageReader: { isInUse: async () => true },
        }),
      );
      inUseApp.use(errorHandler);

      const response = await request(inUseApp)
        .patch('/response-scales/scale_1')
        .send({ name: 'Intento de cambio' });

      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).toContain('Duplícala');
      expect(await currentName()).toBe('Likert 5');
      expect(await prisma.scaleLevel.count({ where: { scaleId: 'scale_1' } })).toBe(3);
      expect(await auditedCount()).toBe(0);
    });
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app).patch('/response-scales/scale_1').send({ name: 'X' });
      expect(response.status).toBe(401);
    });

    it.each([[[]], [['TEACHER']], [['COMMITTEE_MEMBER']]])(
      'answers 403 and audits ACCESS_DENIED for roles %j, who lack parametro.editar (RNF-009)',
      async (roles) => {
        const actor = await createActor(roles as string[]);

        const response = await request(app)
          .patch('/response-scales/scale_1')
          .set('Authorization', `Bearer ${actor.token}`)
          .send({ name: 'Cambio no autorizado' });

        expect(response.status).toBe(403);
        expect(await currentName()).toBe('Likert 5');
        expect(await auditedCount()).toBe(0);
        const denied = await prisma.auditLog.findFirst({
          where: { action: 'ACCESS_DENIED', actor: actor.user.id },
        });
        expect(denied).not.toBeNull();
      },
    );
  });
});
