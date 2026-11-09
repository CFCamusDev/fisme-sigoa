import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { myPermissionsResponseSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorization } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('GET /me/permissions HTTP Routes Integration (PostgreSQL real, HU-008, T-008-04, RS-011, RS-012, D4, D7)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-me-permissions-routes',
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
  });

  it('returns 200 with an empty permissions array for an authenticated user without grants (valid incomplete/minimal case)', async () => {
    const actor = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: [],
    });

    const response = await request(app)
      .get('/me/permissions')
      .set('Authorization', actor.authHeader);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const parsed = myPermissionsResponseSchema.parse(response.body);
    expect(parsed.permissions).toEqual([]);
  });

  it('returns 200 with consolidated OWN and GLOBAL permissions sorted by code without exposing role names or sources', async () => {
    const teacherActor = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: ['TEACHER'],
    });
    // Concedemos permiso directo GLOBAL sobre medicion.ver para verificar precedencia GLOBAL > OWN
    const medicionVerPerm = await prisma.permission.findUniqueOrThrow({
      where: { code: 'medicion.ver' },
    });
    await prisma.userPermission.create({
      data: {
        userId: teacherActor.user.id,
        permissionId: medicionVerPerm.id,
        scope: 'GLOBAL',
        createdBy: 'TEST',
      },
    });

    const response = await request(app)
      .get('/me/permissions')
      .set('Authorization', teacherActor.authHeader);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const parsed = myPermissionsResponseSchema.parse(response.body);
    expect(parsed.permissions.length).toBeGreaterThan(0);

    const codes = parsed.permissions.map((p) => p.code);
    expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b)));

    const medicionVer = parsed.permissions.find((p) => p.code === 'medicion.ver');
    expect(medicionVer).toEqual({ code: 'medicion.ver', scope: 'GLOBAL' });

    const instrumentoVer = parsed.permissions.find((p) => p.code === 'instrumento.ver');
    expect(instrumentoVer).toEqual({ code: 'instrumento.ver', scope: 'OWN' });

    // No expone nombres de rol ni orígenes
    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain('TEACHER');
    expect(raw).not.toContain('sources');
  });

  it('returns 401 when the request has no authentication token', async () => {
    const response = await request(app).get('/me/permissions');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when unknown query parameters are sent (hostile input)', async () => {
    const actor = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: ['TEACHER'],
    });

    const response = await request(app)
      .get('/me/permissions?unexpected=1')
      .set('Authorization', actor.authHeader);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
