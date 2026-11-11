import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { responseScalesResponseSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { seedResponseScaleDefaults } from '../prisma/seed/response-scale-seed.js';

describe('GET /response-scales HTTP Routes Integration (PostgreSQL real, HU-012, T-012-27, CA1, CA2, RF-012, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-response-scales-list-test',
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

  describe('Success (200)', () => {
    it('lists the seeded scales with their levels (CA1)', async () => {
      await seedResponseScaleDefaults(prisma);
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .get('/response-scales')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = responseScalesResponseSchema.parse(response.body);
      expect(body.items.map((item) => item.code).sort()).toEqual([
        'EVIDENCE_4',
        'LIKERT_5',
        'NUMERIC_1_5',
      ]);
      const byCode = Object.fromEntries(body.items.map((item) => [item.code, item]));
      expect(byCode['LIKERT_5']?.levels).toHaveLength(5);
      expect(byCode['NUMERIC_1_5']?.levels).toHaveLength(5);
      expect(byCode['EVIDENCE_4']?.levels).toHaveLength(4);
      expect(body.items.every((item) => item.inUse === false)).toBe(true);
    });

    it('shows that only totally and mostly count as achievement in Evidence 4 (CA2)', async () => {
      await seedResponseScaleDefaults(prisma);
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .get('/response-scales')
        .set('Authorization', `Bearer ${admin.token}`);

      const evidence = responseScalesResponseSchema
        .parse(response.body)
        .items.find((item) => item.code === 'EVIDENCE_4');
      expect(evidence?.levels.map((l) => [l.order, l.label, l.countsAsAchievement])).toEqual([
        [1, 'Se evidencia totalmente', true],
        [2, 'Se evidencia mayormente', true],
        [3, 'Se evidencia parcialmente', false],
        [4, 'No se evidencia en su desempeño', false],
      ]);
    });

    it('filters by type', async () => {
      await seedResponseScaleDefaults(prisma);
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .get('/response-scales?type=NUMERIC')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(200);
      expect(response.body.items.map((item: { code: string }) => item.code)).toEqual([
        'NUMERIC_1_5',
      ]);
    });

    it('answers an empty list when there are no scales (incomplete but valid)', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .get('/response-scales')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [] });
    });

    it('answers an empty list when only scales of another type exist', async () => {
      await prisma.responseScale.create({
        data: {
          code: 'LIKERT_5',
          name: 'Likert',
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
        .get('/response-scales?type=EVIDENCE')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [] });
    });

    it('lets a role with only parametro.ver read the list', async () => {
      await seedResponseScaleDefaults(prisma);
      const member = await createActor(['COMMITTEE_MEMBER']);

      const response = await request(app)
        .get('/response-scales')
        .set('Authorization', `Bearer ${member.token}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(3);
    });
  });

  describe('Validation (400)', () => {
    it.each([
      ['an unknown query field', '?foo=1'],
      ['a type outside the enum', '?type=OTHER'],
      ['a repeated type', '?type=LIKERT&type=NUMERIC'],
      ['an empty type', '?type='],
      ['a 5000 character type', `?type=${'a'.repeat(5000)}`],
    ])('answers 400 for %s', async (_name, query) => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .get(`/response-scales${query}`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app).get('/response-scales');
      expect(response.status).toBe(401);
    });

    it.each([[[]], [['TEACHER']]])(
      'answers 403 and audits ACCESS_DENIED for roles %j, who lack parametro.ver (RNF-009)',
      async (roles) => {
        const actor = await createActor(roles as string[]);

        const response = await request(app)
          .get('/response-scales')
          .set('Authorization', `Bearer ${actor.token}`);

        expect(response.status).toBe(403);
        const denied = await prisma.auditLog.findFirst({
          where: { action: 'ACCESS_DENIED', actor: actor.user.id },
        });
        expect(denied).not.toBeNull();
      },
    );
  });
});
