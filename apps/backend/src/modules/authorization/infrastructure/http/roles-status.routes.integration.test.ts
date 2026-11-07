import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { roleDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import {
  createRoleWithGrants,
  grantRole,
  seedAuthorization,
} from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('PATCH /roles/:id/status HTTP Routes Integration (PostgreSQL real, HU-006, T-006-31, CA3, RF-006, RS-002, RS-020, RNF-017, RNF-030)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-roles-status-test',
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

  async function createActor(roles: string[]) {
    return createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles,
    });
  }

  it('deactivates a role without users without requiring confirmation', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);
    const role = await createRoleWithGrants(prisma, {
      name: `Rol Sin Usuarios ${suffix}`,
    });

    const res = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');

    const parsed = roleDtoSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
    expect(res.body.status).toBe('INACTIVE');
    expect(res.body.deactivatedAt).not.toBeNull();
    expect(res.body.userCount).toBe(0);

    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
    expect(inDb.status).toBe('INACTIVE');
    expect(inDb.deactivatedAt).not.toBeNull();
    expect(inDb.updatedBy).toBe(adminActor.user.id);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'Role', entityId: role.id, action: 'STATE_CHANGE' },
    });
    expect(audit.actor).toBe(adminActor.user.id);
    expect((audit.after as Record<string, unknown>).userCount).toBe(0);
  });

  it('requires confirmation and reports the user count when the role has users (CA3)', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);
    const role = await createRoleWithGrants(prisma, {
      name: `Rol Con Docentes ${suffix}`,
    });

    // Asignar a un usuario
    const user = await createActor([]);
    await grantRole(prisma, user.user.id, role.code);

    const res = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain(
      'El rol está asignado a 1 usuario(s). Confirma para desactivarlo.',
    );

    // El rol permanece ACTIVE y sin fecha de desactivación
    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
    expect(inDb.status).toBe('ACTIVE');
    expect(inDb.deactivatedAt).toBeNull();

    // Sin auditoría
    const auditCount = await prisma.auditLog.count({
      where: { entity: 'Role', entityId: role.id, action: 'STATE_CHANGE' },
    });
    expect(auditCount).toBe(0);
  });

  it('deactivates with confirmation when the role has users', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);
    const role = await createRoleWithGrants(prisma, {
      name: `Rol Confirmado ${suffix}`,
    });

    const user1 = await createActor([]);
    const user2 = await createActor([]);
    await grantRole(prisma, user1.user.id, role.code);
    await grantRole(prisma, user2.user.id, role.code);

    const res = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'INACTIVE', confirmed: true });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INACTIVE');
    expect(res.body.userCount).toBe(2);

    // Asignaciones se conservan
    const count = await prisma.userRole.count({ where: { roleId: role.id } });
    expect(count).toBe(2);

    // Auditoría con userCount = 2
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'Role', entityId: role.id, action: 'STATE_CHANGE' },
    });
    expect((audit.after as Record<string, unknown>).userCount).toBe(2);
  });

  it('a deactivated role stops granting permissions on the next request, and restores on reactivate', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);

    // Crear rol que otorga usuario.ver
    const role = await createRoleWithGrants(prisma, {
      name: `Rol Permiso Temporal ${suffix}`,
      grants: [{ permissionCode: 'usuario.ver', scope: 'GLOBAL' }],
    });

    // Usuario docente que recibe ese rol
    const teacherActor = await createActor([]);
    await grantRole(prisma, teacherActor.user.id, role.code);

    // 1. Con el rol activo: 200 en GET /users
    const resActive = await request(app)
      .get('/users')
      .set('Authorization', teacherActor.authHeader);
    expect(resActive.status).toBe(200);

    // 2. Desactivar el rol
    const resDeact = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'INACTIVE', confirmed: true });
    expect(resDeact.status).toBe(200);

    // Con el MISMO token: inmediatamente 403 en la siguiente petición
    const resInactive = await request(app)
      .get('/users')
      .set('Authorization', teacherActor.authHeader);
    expect(resInactive.status).toBe(403);
    expect(resInactive.body.error.code).toBe('FORBIDDEN');

    // 3. Reactivar el rol
    const resReact = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'ACTIVE' });
    expect(resReact.status).toBe(200);

    // Con el MISMO token: nuevamente 200
    const resRestored = await request(app)
      .get('/users')
      .set('Authorization', teacherActor.authHeader);
    expect(resRestored.status).toBe(200);
  });

  it('rejects assigning an inactive role to a user via POST /users', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);

    const inactiveRole = await createRoleWithGrants(prisma, {
      name: `Rol Inactivo No Asignable ${suffix}`,
      status: 'INACTIVE',
    });

    const res = await request(app)
      .post('/users')
      .set('Authorization', adminActor.authHeader)
      .send({
        names: 'Usuario',
        firstSurname: 'Inactivo',
        email: `usuario.inactivo.${suffix}@untrm.edu.pe`,
        dni: '12345678',
        roleIds: [inactiveRole.id],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('No se puede asignar un rol inactivo');
  });

  it('reactivates the role without requiring confirmation', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);

    const role = await createRoleWithGrants(prisma, {
      name: `Rol Para Reactivar ${suffix}`,
      status: 'INACTIVE',
    });

    const res = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.deactivatedAt).toBeNull();

    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
    expect(inDb.status).toBe('ACTIVE');
    expect(inDb.deactivatedAt).toBeNull();
  });

  it('returns 400 for an unknown status, a string confirmation and unknown keys', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);
    const role = await createRoleWithGrants(prisma, {
      name: `Rol Valida Status ${suffix}`,
    });

    // 1. Status desconocido
    const badStatusRes = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'DELETED' });
    expect(badStatusRes.status).toBe(400);
    expect(badStatusRes.body.error.code).toBe('VALIDATION_ERROR');

    // 2. confirmed como string ("true")
    const strConfirmRes = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'INACTIVE', confirmed: 'true' });
    expect(strConfirmRes.status).toBe(400);
    expect(strConfirmRes.body.error.code).toBe('VALIDATION_ERROR');

    // 3. Claves desconocidas
    const unknownKeyRes = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'INACTIVE', name: 'Intento de renombrar' });
    expect(unknownKeyRes.status).toBe(400);
    expect(unknownKeyRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).patch('/roles/any-id/status').send({ status: 'INACTIVE' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 without rol.editar', async () => {
    const unauthorizedActor = await createActor([]);
    const suffix = Date.now().toString().slice(-4);
    const role = await createRoleWithGrants(prisma, {
      name: `Rol Forbidden Status ${suffix}`,
    });

    const res = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', unauthorizedActor.authHeader)
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    // Sin cambios en BD
    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
    expect(inDb.status).toBe('ACTIVE');
  });

  it('returns 404 for an unknown role', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const res = await request(app)
      .patch('/roles/non-existent-role-uuid/status')
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 for the administrator role and for repeating the current status', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });

    // 1. Intentar desactivar ADMINISTRATOR -> 409
    const resAdmin = await request(app)
      .patch(`/roles/${adminRole.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'INACTIVE', confirmed: true });

    expect(resAdmin.status).toBe(409);
    expect(resAdmin.body.error.code).toBe('CONFLICT');
    expect(resAdmin.body.error.message).toContain('El rol Administrador no puede ser desactivado');

    // 2. Repetir estado actual ACTIVE -> 409
    const suffix = Date.now().toString().slice(-4);
    const role = await createRoleWithGrants(prisma, {
      name: `Rol Repetir Status ${suffix}`,
      status: 'ACTIVE',
    });

    const resRepeat = await request(app)
      .patch(`/roles/${role.id}/status`)
      .set('Authorization', adminActor.authHeader)
      .send({ status: 'ACTIVE' });

    expect(resRepeat.status).toBe(409);
    expect(resRepeat.body.error.code).toBe('CONFLICT');
    expect(resRepeat.body.error.message).toContain('El rol ya se encuentra activo');
  });

  it(
    'only one of N concurrent PATCH status requests returns 200',
    { timeout: 20_000 },
    async () => {
      const adminActor = await createActor(['ADMINISTRATOR']);
      const suffix = Date.now().toString().slice(-4);
      const role = await createRoleWithGrants(prisma, {
        name: `Rol Concurrente Status ${suffix}`,
      });

      const N = 5;
      const promises = Array.from({ length: N }, () =>
        request(app)
          .patch(`/roles/${role.id}/status`)
          .set('Authorization', adminActor.authHeader)
          .send({ status: 'INACTIVE' }),
      );

      const responses = await Promise.all(promises);

      const status200 = responses.filter((r) => r.status === 200);
      const status409 = responses.filter((r) => r.status === 409);

      // Exactamente una devuelve 200
      expect(status200).toHaveLength(1);
      // Las N-1 restantes devuelven 409 (transición inválida porque ya está inactivo)
      expect(status409).toHaveLength(N - 1);

      // El rol quedó INACTIVE en BD
      const inDb = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
      expect(inDb.status).toBe('INACTIVE');

      // Exactamente una auditoría STATE_CHANGE
      const audits = await prisma.auditLog.findMany({
        where: { entity: 'Role', entityId: role.id, action: 'STATE_CHANGE' },
      });
      expect(audits).toHaveLength(1);
    },
  );
});
