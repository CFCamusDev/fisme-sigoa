import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { listSemestersResponseSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('GET /semesters HTTP Routes Integration (PostgreSQL real, HU-010, T-010-17, CA1, RF-010, RS-002, RS-015, RNF-009, D1, D5, D6)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-semesters-list-test',
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

  it('returns 200 with semesters ordered by startDate descending and Cache-Control: no-store (CA1, D6)', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    // Insertar 3 semestres con fechas no superpuestas en orden cronológico desordenado
    await prisma.semester.createMany({
      data: [
        {
          id: 'sem_2026_1',
          code: '2026-I',
          startDate: new Date('2026-03-01T00:00:00.000Z'),
          endDate: new Date('2026-07-31T00:00:00.000Z'),
          createdBy: admin.user.id,
        },
        {
          id: 'sem_2027_2',
          code: '2027-II',
          startDate: new Date('2027-08-01T00:00:00.000Z'),
          endDate: new Date('2027-12-31T00:00:00.000Z'),
          createdBy: admin.user.id,
        },
        {
          id: 'sem_2027_1',
          code: '2027-I',
          startDate: new Date('2027-03-01T00:00:00.000Z'),
          endDate: new Date('2027-07-31T00:00:00.000Z'),
          createdBy: admin.user.id,
        },
      ],
    });

    const response = await request(app)
      .get('/semesters')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const parsed = listSemestersResponseSchema.parse(response.body);
    expect(parsed.items).toHaveLength(3);

    // Verificación del orden descendente por fecha de inicio
    expect(parsed.items[0]?.code).toBe('2027-II');
    expect(parsed.items[1]?.code).toBe('2027-I');
    expect(parsed.items[2]?.code).toBe('2026-I');

    // No debe generar entradas de auditoría para lectura (D6)
    const auditRows = await prisma.auditLog.findMany({
      where: { entity: 'Semester' },
    });
    expect(auditRows).toHaveLength(0);
  });

  it('returns 200 with empty items list when no semesters exist in database', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .get('/semesters')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it('returns 400 when unexpected query parameters are provided (.strict() violation)', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .get('/semesters?filter=active&sort=asc')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(response.status).toBe(400);
  });

  it('returns 401 when request is unauthenticated', async () => {
    const response = await request(app).get('/semesters');
    expect(response.status).toBe(401);
  });

  it('returns 403 and records ACCESS_DENIED audit when actor lacks parametro.ver permission (RNF-009, RS-002)', async () => {
    const teacher = await createActor(['TEACHER']);

    const response = await request(app)
      .get('/semesters')
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(response.status).toBe(403);

    const deniedAudit = await prisma.auditLog.findFirst({
      where: { action: 'ACCESS_DENIED', actor: teacher.user.id },
    });
    expect(deniedAudit).not.toBeNull();
  });
});
