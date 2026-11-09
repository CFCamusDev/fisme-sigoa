import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createAuthorizationModule } from '../../index.js';
import { seedAuthorization } from '../prisma/seed/authorization-seed.js';

describe('requirePermission Integration (PostgreSQL real, RS-002, RS-011, RS-012, RF-008, RNF-004)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);

  const authzModule = createAuthorizationModule({
    dbProvider: uow,
    unitOfWork: uow,
    auditLogger: auditServices.auditLogger,
  });

  const env = createTestEnv({
    TRUST_PROXY: 1,
  });

  const app = createApp({
    env,
    setupRoutes: (instance) => {
      // Middleware de prueba para simular actor autenticado desde cabecera x-actor-id
      instance.use((req, _res, next) => {
        const actorHeader = req.headers['x-actor-id'];
        if (actorHeader && typeof actorHeader === 'string') {
          const ctx = getRequestContext();
          if (ctx) {
            ctx.actor = actorHeader;
          }
        }
        next();
      });

      instance.post('/test/users', authzModule.requirePermission('usuario.crear'), (_req, res) => {
        res.status(200).json({ success: true });
      });

      instance.patch(
        '/test/users/:id/roles',
        authzModule.requirePermission('usuario.editar'),
        (_req, res) => {
          res.status(200).json({ success: true });
        },
      );
    },
  });

  async function createFixtureUser(dniSuffix: string) {
    return prisma.user.create({
      data: {
        email: `authz-test-${dniSuffix}@untrm.edu.pe`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        names: 'Test',
        firstSurname: 'User',
        secondSurname: dniSuffix,
        dni: `8888${dniSuffix}`,
        status: 'ACTIVE',
      },
    });
  }

  it('permite el acceso (200) cuando el usuario tiene un rol con el permiso requerido', async () => {
    await seedAuthorization(prisma);

    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMINISTRATOR' },
    });
    const adminUser = await createFixtureUser('0001');

    await authzModule.userRoleGateway.replaceRoles(adminUser.id, [adminRole.id]);

    const response = await request(app).post('/test/users').set('x-actor-id', adminUser.id).send();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });

    const denials = await prisma.auditLog.findMany({
      where: { action: 'ACCESS_DENIED' },
    });
    expect(denials).toHaveLength(0);
  });

  it('returns 403 and writes an ACCESS_DENIED audit row when the actor lacks the permission', async () => {
    await seedAuthorization(prisma);

    const teacherRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'TEACHER' },
    });
    const teacherUser = await createFixtureUser('0002');

    await authzModule.userRoleGateway.replaceRoles(teacherUser.id, [teacherRole.id]);

    const response = await request(app)
      .patch(`/test/users/${teacherUser.id}/roles?token=secret-not-logged`)
      .set('x-actor-id', teacherUser.id)
      .set('x-forwarded-for', '190.119.10.25')
      .send();

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: expect.objectContaining({
        code: 'FORBIDDEN',
        message: 'No tienes permiso para realizar esta acción.',
      }),
    });

    const auditRows = await prisma.auditLog.findMany({
      where: { action: 'ACCESS_DENIED', actor: teacherUser.id },
    });
    expect(auditRows).toHaveLength(1);
    const row = auditRows[0]!;
    expect(row.entity).toBe('Permission');
    expect(row.entityId).toBe('usuario.editar');
    expect(row.after).toEqual({
      reason: 'MISSING_PERMISSION',
      requiredScope: 'GLOBAL',
      grantedScope: null,
      method: 'PATCH',
      route: '/test/users/:id/roles',
    });
    // Garantiza que no se registran datos personales ni la URL real ni query params
    const serialized = JSON.stringify(row.after);
    expect(serialized).not.toContain(teacherUser.email);
    expect(serialized).not.toContain(teacherUser.dni);
    expect(serialized).not.toContain(teacherUser.names);
    expect(serialized).not.toContain('secret-not-logged');
    expect(serialized).not.toContain(teacherUser.id);
  });

  it('deniega con 401 sin escribir fila de auditoría cuando no hay actor autenticado en el contexto', async () => {
    const response = await request(app).post('/test/users').send();

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    });

    const auditRows = await prisma.auditLog.findMany({
      where: { action: 'ACCESS_DENIED' },
    });
    expect(auditRows).toHaveLength(0);
  });

  it('keeps a valid audit chain after 20 simultaneous denied requests', async () => {
    await seedAuthorization(prisma);

    const teacherRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'TEACHER' },
    });
    const teacherUser = await createFixtureUser('0003');
    await authzModule.userRoleGateway.replaceRoles(teacherUser.id, [teacherRole.id]);

    const requests = Array.from({ length: 20 }, (_, idx) =>
      request(app)
        .post('/test/users')
        .set('x-actor-id', teacherUser.id)
        .set('x-forwarded-for', `10.10.0.${idx + 1}`)
        .send(),
    );

    const responses = await Promise.all(requests);
    for (const res of responses) {
      expect(res.status).toBe(403);
    }

    const rows = await prisma.auditLog.findMany({
      orderBy: { sequence: 'asc' },
    });
    expect(rows).toHaveLength(20);
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i]!.sequence).toBe(BigInt(i + 1));
      expect(rows[i]!.action).toBe('ACCESS_DENIED');
    }

    const verification = await auditServices.chainVerifier.verify();
    expect(verification).toEqual({
      valid: true,
      checked: 20,
    });
  }, 15_000);
});
