import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createAuthorizationModule } from '../../index.js';
import { seedAuthorization } from '../prisma/seed/authorization-seed.js';

describe('requirePermission Integration (PostgreSQL real, RS-002, RS-011, RS-012, RNF-004)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);

  const authzModule = createAuthorizationModule({
    dbProvider: uow,
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
  });

  it('deniega con 403 cuando el usuario autenticado tiene un rol sin el permiso requerido', async () => {
    await seedAuthorization(prisma);

    const teacherRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'TEACHER' },
    });
    const teacherUser = await createFixtureUser('0002');

    await authzModule.userRoleGateway.replaceRoles(teacherUser.id, [teacherRole.id]);

    const response = await request(app)
      .post('/test/users')
      .set('x-actor-id', teacherUser.id)
      .send();

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: expect.objectContaining({
        code: 'FORBIDDEN',
        message: 'No tienes permiso para realizar esta acción.',
      }),
    });
  });

  it('deniega con 401 cuando no hay actor autenticado en el contexto', async () => {
    const response = await request(app).post('/test/users').send();

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    });
  });
});
