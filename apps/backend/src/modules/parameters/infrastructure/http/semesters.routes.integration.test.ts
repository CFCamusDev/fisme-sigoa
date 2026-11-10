import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { semesterDtoSchema, listSemestersResponseSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('POST /semesters HTTP Routes Integration (PostgreSQL real, HU-010, T-010-16, CA1, CA2, CA3, RF-010, RS-002, RS-020, RNF-008, RNF-009, D1, D2)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-semesters-post-test',
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
    await prisma.semester.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.auditChainHead.deleteMany();
    await seedAuthorizationFast(prisma);
  });

  async function createActor(roles: string[]) {
    return createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles,
    });
  }

  describe('Success & Acceptances', () => {
    it('creates a semester, returns 201 with DTO, audits CREATE, and subsequent GET reflects it (CA1, RS-020, RS-043)', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        });

      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toBe('no-store');

      const parsedDto = semesterDtoSchema.parse(response.body);
      expect(parsedDto.code).toBe('2027-I');
      expect(parsedDto.startDate).toBe('2027-03-01');
      expect(parsedDto.endDate).toBe('2027-07-31');

      // Verificación en base de datos
      const inDb = await prisma.semester.findUnique({
        where: { code: '2027-I' },
      });
      expect(inDb).not.toBeNull();
      expect(inDb?.id).toBe(parsedDto.id);

      // Verificación de auditoría
      const auditLog = await prisma.auditLog.findFirst({
        where: { entity: 'Semester', entityId: parsedDto.id, action: 'CREATE' },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actor).toBe(admin.user.id);
      expect(auditLog?.after).toMatchObject({
        code: '2027-I',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      });

      // CA1: el GET siguiente lo incluye inmediatamente en los selectores
      const getResponse = await request(app)
        .get('/semesters')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(getResponse.status).toBe(200);
      const parsedList = listSemestersResponseSchema.parse(getResponse.body);
      expect(parsedList.items.some((item) => item.code === '2027-I')).toBe(true);
    });

    it('accepts trimmed valid code with whitespace around it', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '  2027-II  ',
          startDate: '2027-08-01',
          endDate: '2027-12-31',
        });

      expect(response.status).toBe(201);
      expect(response.body.code).toBe('2027-II');
    });

    it('accepts contiguous semesters starting the exact next day without conflict', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      // Crear primer semestre
      const res1 = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        });
      expect(res1.status).toBe(201);

      // Segundo semestre inicia inmediatamente el 2027-08-01
      const res2 = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '2027-II',
          startDate: '2027-08-01',
          endDate: '2027-12-31',
        });
      expect(res2.status).toBe(201);
    });
  });

  describe('Validation & Hostile inputs (400)', () => {
    it('returns 400 when body is empty {}', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('returns 400 when body contains unknown fields (.strict() violation)', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
          unknownField: 'malicious',
        });

      expect(response.status).toBe(400);
    });

    it('returns 400 when code is empty or whitespace', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '   ',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        });

      expect(response.status).toBe(400);
    });

    it('returns 400 and explains expected format when code violates pattern (CA3)', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const invalidCodes = ['2027-III', '2027-i', '27-I', 'A'.repeat(5000), '2027-01'];

      for (const code of invalidCodes) {
        const response = await request(app)
          .post('/semesters')
          .set('Authorization', `Bearer ${admin.token}`)
          .send({
            code,
            startDate: '2027-03-01',
            endDate: '2027-07-31',
          });

        expect(response.status).toBe(400);
        expect(response.body.message ?? JSON.stringify(response.body)).toMatch(/AAAA-I|AAAA-II/);
      }
    });

    it('returns 400 when calendar dates are nonexistent or invalid format', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const invalidDates = [
        { startDate: '2027-13-01', endDate: '2027-07-31' },
        { startDate: '2027-02-30', endDate: '2027-07-31' },
        { startDate: '01/03/2027', endDate: '2027-07-31' },
        { startDate: '2027-03-01T00:00:00Z', endDate: '2027-07-31' },
      ];

      for (const dates of invalidDates) {
        const response = await request(app)
          .post('/semesters')
          .set('Authorization', `Bearer ${admin.token}`)
          .send({
            code: '2027-I',
            ...dates,
          });

        expect(response.status).toBe(400);
      }
    });

    it('returns 400 when startDate is equal to or greater than endDate', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const responseEqual = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-03-01',
        });
      expect(responseEqual.status).toBe(400);

      const responseGreater = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '2027-I',
          startDate: '2027-08-01',
          endDate: '2027-03-01',
        });
      expect(responseGreater.status).toBe(400);
    });

    it('returns 400 when unknown query parameters are supplied', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await request(app)
        .post('/semesters?unexpectedParam=1')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const response = await request(app).post('/semesters').send({
        code: '2027-I',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      });

      expect(response.status).toBe(401);
    });

    it('returns 403 and records ACCESS_DENIED audit when actor lacks parametro.editar permission (RNF-009, RS-002)', async () => {
      const teacher = await createActor(['TEACHER']);

      const response = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${teacher.token}`)
        .send({
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        });

      expect(response.status).toBe(403);

      const deniedAudit = await prisma.auditLog.findFirst({
        where: { action: 'ACCESS_DENIED', actor: teacher.user.id },
      });
      expect(deniedAudit).not.toBeNull();
    });
  });

  describe('Conflicts (409)', () => {
    it('returns 409 when semester code already exists', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      await request(app).post('/semesters').set('Authorization', `Bearer ${admin.token}`).send({
        code: '2027-I',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      });

      // Mismo código pero en fechas disjuntas futuras
      const duplicateRes = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '2027-I',
          startDate: '2028-03-01',
          endDate: '2028-07-31',
        });

      expect(duplicateRes.status).toBe(409);
    });

    it('returns 409 when date range overlaps with existing semester, including shared boundary day (CA2)', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      await request(app).post('/semesters').set('Authorization', `Bearer ${admin.token}`).send({
        code: '2027-I',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      });

      // Comparte el día 2027-07-31 como frontera
      const overlapBoundaryRes = await request(app)
        .post('/semesters')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          code: '2027-II',
          startDate: '2027-07-31',
          endDate: '2027-12-31',
        });

      expect(overlapBoundaryRes.status).toBe(409);
      expect(overlapBoundaryRes.body.error?.message).toMatch(/2027-I/);
    });
  });

  describe('Concurrency & Idempotence (PostgreSQL real, testTimeout 15s)', () => {
    it('lets exactly one of 20 simultaneous POST requests with the same code win and keeps a valid audit chain', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const attempts = Array.from({ length: 20 }, () =>
        request(app).post('/semesters').set('Authorization', `Bearer ${admin.token}`).send({
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        }),
      );

      const results = await Promise.allSettled(attempts);
      const responses = results.map((r) => {
        if (r.status === 'fulfilled') return r.value;
        throw r.reason;
      });

      const success = responses.filter((res) => res.status === 201);
      const conflict = responses.filter((res) => res.status === 409);

      expect(success).toHaveLength(1);
      expect(conflict).toHaveLength(19);

      const countInDb = await prisma.semester.count();
      expect(countInDb).toBe(1);

      const auditRows = await prisma.auditLog.findMany({
        where: { entity: 'Semester', action: 'CREATE' },
      });
      expect(auditRows).toHaveLength(1);

      // Verificación de integridad de la cadena de auditoría
      const chainVerification = await auditServices.chainVerifier.verify();
      expect(chainVerification.valid).toBe(true);
    }, 15_000);

    it('lets exactly one of N simultaneous overlapping POST requests win', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const overlappingPayloads = [
        { code: '2027-I', startDate: '2027-03-01', endDate: '2027-07-31' },
        { code: '2027-II', startDate: '2027-05-01', endDate: '2027-10-31' },
        { code: '2028-I', startDate: '2027-04-01', endDate: '2027-06-30' },
        { code: '2028-II', startDate: '2027-01-01', endDate: '2027-12-31' },
      ];

      const attempts = overlappingPayloads.map((body) =>
        request(app).post('/semesters').set('Authorization', `Bearer ${admin.token}`).send(body),
      );

      const results = await Promise.allSettled(attempts);
      const responses = results.map((r) => {
        if (r.status === 'fulfilled') return r.value;
        throw r.reason;
      });

      const success = responses.filter((res) => res.status === 201);
      const conflict = responses.filter((res) => res.status === 409);

      expect(success).toHaveLength(1);
      expect(conflict).toHaveLength(overlappingPayloads.length - 1);

      const countInDb = await prisma.semester.count();
      expect(countInDb).toBe(1);
    }, 15_000);

    it('creates non-overlapping semesters simultaneously without losing any', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const nonOverlappingPayloads = [
        { code: '2027-I', startDate: '2027-03-01', endDate: '2027-07-31' },
        { code: '2027-II', startDate: '2027-08-01', endDate: '2027-12-31' },
        { code: '2028-I', startDate: '2028-03-01', endDate: '2028-07-31' },
      ];

      const attempts = nonOverlappingPayloads.map((body) =>
        request(app).post('/semesters').set('Authorization', `Bearer ${admin.token}`).send(body),
      );

      const results = await Promise.allSettled(attempts);
      const responses = results.map((r) => {
        if (r.status === 'fulfilled') return r.value;
        throw r.reason;
      });

      const success = responses.filter((res) => res.status === 201);
      expect(success).toHaveLength(3);

      const countInDb = await prisma.semester.count();
      expect(countInDb).toBe(3);
    }, 15_000);
  });
});
