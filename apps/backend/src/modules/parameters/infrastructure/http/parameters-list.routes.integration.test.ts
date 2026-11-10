import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { parametersResponseSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorization } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { seedParameterDefaults } from '../prisma/seed/parameter-seed.js';

describe('GET /parameters HTTP Routes Integration (PostgreSQL real, HU-011, T-011-20, CA1, CA2, RF-011, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-parameters-list-test',
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
    await seedAuthorization(prisma);
    await seedParameterDefaults(prisma);
  });

  async function createActor(roles: string[]) {
    return createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });
  }

  async function createSemesters() {
    await prisma.semester.createMany({
      data: [
        {
          code: '2026-II',
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
        },
        {
          code: '2027-I',
          startDate: new Date('2027-03-01T00:00:00.000Z'),
          endDate: new Date('2027-07-31T00:00:00.000Z'),
        },
      ],
    });
  }

  describe('Success (200)', () => {
    it('lists the seeded defaults when there are no semesters (CA1, incomplete but valid)', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .get('/parameters')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = parametersResponseSchema.parse(response.body);
      expect(body.semesterCode).toBeNull();
      expect(Object.fromEntries(body.items.map((item) => [item.key, item.value]))).toEqual({
        UMBRAL_LOGRADO: 14,
        META_AG: 70,
        PESO_DIRECTA: 70,
        PESO_INDIRECTA: 30,
        MIN_PARTICIPACION: 3,
        TOKEN_DIAS: 7,
        LOGIN_INTENTOS: 5,
      });
    });

    it('lists the defaults for a semester without own versions', async () => {
      await createSemesters();
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .get('/parameters?semesterCode=2027-I')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(200);
      const body = parametersResponseSchema.parse(response.body);
      expect(body.semesterCode).toBe('2027-I');
      expect(body.items.every((item) => item.effectiveFromSemesterCode === null)).toBe(true);
    });

    it('shows the version history and resolves each semester to its own value (CA2)', async () => {
      await createSemesters();
      const admin = await createActor(['ADMINISTRATOR']);
      const define = await request(app)
        .post('/parameters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ semesterCode: '2027-I', values: [{ key: 'UMBRAL_LOGRADO', value: 15 }] });
      expect(define.status).toBe(201);

      const [before, from] = await Promise.all([
        request(app)
          .get('/parameters?semesterCode=2026-II')
          .set('Authorization', `Bearer ${admin.token}`),
        request(app)
          .get('/parameters?semesterCode=2027-I')
          .set('Authorization', `Bearer ${admin.token}`),
      ]);

      const find = (res: request.Response) =>
        parametersResponseSchema.parse(res.body).items.find((i) => i.key === 'UMBRAL_LOGRADO');
      expect(find(before)?.value).toBe(14);
      expect(find(from)).toMatchObject({ value: 15, effectiveFromSemesterCode: '2027-I' });
      expect(find(from)?.versions).toEqual([
        { value: 14, effectiveFromSemesterCode: null, effectiveToSemesterCode: '2026-II' },
        { value: 15, effectiveFromSemesterCode: '2027-I', effectiveToSemesterCode: null },
      ]);
    });

    it('lets a committee member, who has parametro.ver, read the values', async () => {
      const member = await createActor(['COMMITTEE_MEMBER']);

      const response = await request(app)
        .get('/parameters')
        .set('Authorization', `Bearer ${member.token}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Validation (400, 404)', () => {
    it.each([
      ['an unknown field', '?other=1'],
      ['an empty semesterCode', '?semesterCode='],
      ['a malformed semesterCode', '?semesterCode=2027-III'],
      ['a lowercase semesterCode', '?semesterCode=2027-i'],
      ['a 5000 character semesterCode', `?semesterCode=${'x'.repeat(5000)}`],
      ['a repeated semesterCode', '?semesterCode=2027-I&semesterCode=2027-II'],
    ])('answers 400 for %s', async (_name, query) => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .get(`/parameters${query}`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('answers 404 for a semester that does not exist', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .get('/parameters?semesterCode=2099-I')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app).get('/parameters');
      expect(response.status).toBe(401);
    });

    it('answers 403 and audits ACCESS_DENIED for a role without parametro.ver (RNF-009)', async () => {
      const teacher = await createActor(['TEACHER']);

      const response = await request(app)
        .get('/parameters')
        .set('Authorization', `Bearer ${teacher.token}`);

      expect(response.status).toBe(403);
      const denied = await prisma.auditLog.findFirst({
        where: { action: 'ACCESS_DENIED', actor: teacher.user.id },
      });
      expect(denied).not.toBeNull();
    });
  });
});
