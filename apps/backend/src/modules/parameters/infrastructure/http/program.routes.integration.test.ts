import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { programDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('GET /program HTTP Routes Integration (PostgreSQL real, HU-009, T-009-15, CA1, CA2, RS-002, RS-015, D7, D10)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-program-routes-test',
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
    await prisma.program.deleteMany();
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

  it('returns 200 with program DTO and Cache-Control no-store when program is configured', async () => {
    await prisma.program.create({
      data: {
        id: 'prog-epis-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'Facultad de Ingeniería Civil y Ambiental',
        createdBy: 'system-seed',
        updatedBy: 'system-seed',
      },
    });

    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app).get('/program').set('Authorization', admin.authHeader);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-type']).toMatch(/application\/json/);

    const parsed = programDtoSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe('prog-epis-1');
      expect(parsed.data.code).toBe('EPIS');
      expect(parsed.data.name).toBe('Ingeniería de Sistemas');
      expect(parsed.data.faculty).toBe('Facultad de Ingeniería Civil y Ambiental');
      expect(parsed.data.updatedAt).toBeDefined();
    }
  }, 15_000);

  it('returns 400 when unknown query parameters are provided', async () => {
    await prisma.program.create({
      data: {
        id: 'prog-epis-2',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'Facultad de Ingeniería',
      },
    });

    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .get('/program?unexpected=param')
      .set('Authorization', admin.authHeader);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  }, 15_000);

  it('returns 401 when request is unauthenticated', async () => {
    const response = await request(app).get('/program');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  }, 15_000);

  it('returns 403 and records ACCESS_DENIED audit when actor lacks parametro.ver permission', async () => {
    await prisma.program.create({
      data: {
        id: 'prog-epis-3',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'Facultad de Ingeniería',
      },
    });

    // Un usuario con rol TEACHER no tiene permiso parametro.ver (LS 3.3 fila 2)
    const teacher = await createActor(['TEACHER']);

    const response = await request(app).get('/program').set('Authorization', teacher.authHeader);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');

    const auditRows = await prisma.auditLog.findMany({
      where: {
        action: 'ACCESS_DENIED',
        actor: teacher.user.id,
      },
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.entity).toBe('Permission');
    expect(auditRows[0]?.entityId).toBe('parametro.ver');
  }, 15_000);

  it('returns 404 when program table is empty', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app).get('/program').set('Authorization', admin.authHeader);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBe('No existe un programa configurado.');
  }, 15_000);
});
