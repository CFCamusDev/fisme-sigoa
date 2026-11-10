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

describe('PATCH /program HTTP Routes Integration (PostgreSQL real, HU-009, T-009-16, CA1, CA2, RS-002, RS-020, RNF-008, RNF-009, D6, D7, D10)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-program-patch-test',
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

  async function seedInitialProgram() {
    return await prisma.program.create({
      data: {
        id: 'prog-epis-patch-1',
        code: 'EPIS',
        name: 'Escuela Profesional de Ingeniería de Sistemas',
        faculty: 'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica',
        createdBy: 'system-seed',
        updatedBy: 'system-seed',
      },
    });
  }

  it('updates partial fields (name and faculty), audits PARAMETER_CHANGE and returns 200 with DTO', async () => {
    await seedInitialProgram();
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send({
        name: 'Ingeniería de Sistemas e Informática',
        faculty: 'Facultad de Ingeniería',
      });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const parsed = programDtoSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe('EPIS');
      expect(parsed.data.name).toBe('Ingeniería de Sistemas e Informática');
      expect(parsed.data.faculty).toBe('Facultad de Ingeniería');
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'PARAMETER_CHANGE',
        entity: 'Program',
        entityId: 'prog-epis-patch-1',
      },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.actor).toBe(admin.user.id);
    expect(auditLogs[0]?.before).toEqual({
      code: 'EPIS',
      name: 'Escuela Profesional de Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica',
    });
    expect(auditLogs[0]?.after).toEqual({
      code: 'EPIS',
      name: 'Ingeniería de Sistemas e Informática',
      faculty: 'Facultad de Ingeniería',
    });
  }, 15_000);

  it('CA2: subsequent GET /program reflects the updated name immediately', async () => {
    await seedInitialProgram();
    const admin = await createActor(['ADMINISTRATOR']);

    const patchRes = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send({
        name: 'Nombre Actualizado Para Documentos',
      });
    expect(patchRes.status).toBe(200);

    const getRes = await request(app).get('/program').set('Authorization', admin.authHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('Nombre Actualizado Para Documentos');
  }, 15_000);

  it('is idempotent when identical payload is sent: returns 200 without creating new audit entry', async () => {
    await seedInitialProgram();
    const admin = await createActor(['ADMINISTRATOR']);

    const payload = {
      code: 'EPIS',
      name: 'Escuela Profesional de Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica',
    };

    const firstRes = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send(payload);
    expect(firstRes.status).toBe(200);

    const auditCountBefore = await prisma.auditLog.count({
      where: { action: 'PARAMETER_CHANGE', entity: 'Program' },
    });
    expect(auditCountBefore).toBe(0);

    const secondRes = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send(payload);
    expect(secondRes.status).toBe(200);

    const auditCountAfter = await prisma.auditLog.count({
      where: { action: 'PARAMETER_CHANGE', entity: 'Program' },
    });
    expect(auditCountAfter).toBe(0);
  }, 15_000);

  it('returns 400 when body is empty {}', async () => {
    await seedInitialProgram();
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  }, 15_000);

  it('returns 400 when body contains unknown fields (.strict violation)', async () => {
    await seedInitialProgram();
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send({
        name: 'Nuevo Nombre',
        unknownField: 'malicious',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  }, 15_000);

  it('returns 400 when name is empty, too short or too long', async () => {
    await seedInitialProgram();
    const admin = await createActor(['ADMINISTRATOR']);

    const tooShortRes = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send({ name: '   ' });
    expect(tooShortRes.status).toBe(400);
    expect(tooShortRes.body.error.code).toBe('VALIDATION_ERROR');

    const tooLongRes = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send({ name: 'a'.repeat(151) });
    expect(tooLongRes.status).toBe(400);
    expect(tooLongRes.body.error.code).toBe('VALIDATION_ERROR');
  }, 15_000);

  it('returns 400 when code is lowercase or contains invalid characters', async () => {
    await seedInitialProgram();
    const admin = await createActor(['ADMINISTRATOR']);

    const lowerRes = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send({ code: 'epis' });
    expect(lowerRes.status).toBe(400);
    expect(lowerRes.body.error.code).toBe('VALIDATION_ERROR');

    const symbolsRes = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send({ code: 'EPIS@UNTRM' });
    expect(symbolsRes.status).toBe(400);
    expect(symbolsRes.body.error.code).toBe('VALIDATION_ERROR');
  }, 15_000);

  it('returns 400 when query parameters are supplied', async () => {
    await seedInitialProgram();
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .patch('/program?unexpected=param')
      .set('Authorization', admin.authHeader)
      .send({ name: 'Nuevo Nombre' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  }, 15_000);

  it('returns 401 when request is unauthenticated', async () => {
    const response = await request(app).patch('/program').send({ name: 'Nuevo Nombre' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  }, 15_000);

  it('returns 403 and records ACCESS_DENIED audit when actor lacks parametro.editar permission', async () => {
    await seedInitialProgram();
    // COMMITTEE_MEMBER tiene parametro.ver pero NO tiene parametro.editar (LS 3.3 fila 2)
    const committeeMember = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .patch('/program')
      .set('Authorization', committeeMember.authHeader)
      .send({ name: 'Nuevo Nombre Por Miembro De Comité' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');

    const auditRows = await prisma.auditLog.findMany({
      where: {
        action: 'ACCESS_DENIED',
        actor: committeeMember.user.id,
      },
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.entity).toBe('Permission');
    expect(auditRows[0]?.entityId).toBe('parametro.editar');
  }, 15_000);

  it('returns 404 when program table is empty', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send({ name: 'Nuevo Nombre' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBe('No existe un programa configurado.');
  }, 15_000);

  it('returns 409 when changing code to one already used by another record', async () => {
    await seedInitialProgram();
    // Inserción manual de una segunda fila para probar conflicto de código
    await prisma.program.create({
      data: {
        id: 'prog-other-conflict-1',
        code: 'EPIS-CONFLICT',
        name: 'Otro programa',
        faculty: 'Otra facultad',
      },
    });

    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .patch('/program')
      .set('Authorization', admin.authHeader)
      .send({ code: 'EPIS-CONFLICT' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  }, 15_000);

  it('applies 20 simultaneous identical PATCH requests once and keeps a valid audit chain', async () => {
    await seedInitialProgram();
    const admin = await createActor(['ADMINISTRATOR']);

    const calls = Array.from({ length: 20 }, () =>
      request(app)
        .patch('/program')
        .set('Authorization', admin.authHeader)
        .send({ name: 'Nombre Concurrente Idéntico' }),
    );

    const results = await Promise.all(calls);
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Nombre Concurrente Idéntico');
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'PARAMETER_CHANGE',
        entity: 'Program',
        entityId: 'prog-epis-patch-1',
      },
    });
    // Solo 1 auditoría porque las otras 19 al encontrar el dato ya modificado son no-ops
    expect(auditLogs).toHaveLength(1);

    const chainResult = await auditServices.chainVerifier.verify();
    expect(chainResult.valid).toBe(true);
    expect(chainResult.checked).toBe(1);
  }, 15_000);

  it('serializes two different simultaneous PATCH requests and keeps both audit rows', async () => {
    await seedInitialProgram();
    const admin = await createActor(['ADMINISTRATOR']);

    const [resA, resB] = await Promise.all([
      request(app)
        .patch('/program')
        .set('Authorization', admin.authHeader)
        .send({ name: 'Nombre Concurrente A' }),
      request(app)
        .patch('/program')
        .set('Authorization', admin.authHeader)
        .send({ name: 'Nombre Concurrente B' }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'PARAMETER_CHANGE',
        entity: 'Program',
        entityId: 'prog-epis-patch-1',
      },
      orderBy: { sequence: 'asc' },
    });
    expect(auditLogs).toHaveLength(2);

    const finalProgram = await prisma.program.findUnique({
      where: { id: 'prog-epis-patch-1' },
    });
    expect(['Nombre Concurrente A', 'Nombre Concurrente B']).toContain(finalProgram?.name);

    const chainResult = await auditServices.chainVerifier.verify();
    expect(chainResult.valid).toBe(true);
    expect(chainResult.checked).toBe(2);
  }, 15_000);
});
