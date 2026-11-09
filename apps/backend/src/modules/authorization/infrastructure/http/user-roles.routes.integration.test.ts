import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { userAccessSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import {
  seedAuthorization,
  createRoleWithGrants,
} from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('PUT /users/:id/roles HTTP Routes Integration (PostgreSQL real, HU-007, T-007-24, CA1, RF-007, RS-002, RS-012, RS-013, RS-020, RNF-009, RNF-017, RNF-022, D1, D4, D5, D6, D7, D8, D9)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-user-roles-routes-test',
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

  async function createTargetUser(emailPrefix = 'target') {
    return prisma.user.create({
      data: {
        names: 'Target',
        firstSurname: 'User',
        email: `${emailPrefix}_${Date.now()}_${Math.random()}@unterm.edu.pe`,
        status: 'ACTIVE',
      },
    });
  }

  it('replaces user roles, returns 200 with UserAccessDto, and records ROLE_CHANGE audit with before and after', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('assign_roles');

    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
    const directorRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'PROGRAM_DIRECTOR' },
    });

    // 1. Asignamos dos roles (CA1: unión de roles)
    const response = await request(app)
      .put(`/users/${targetUser.id}/roles`)
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: [teacherRole.id, directorRole.id] });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const parsed = userAccessSchema.parse(response.body);
    expect(parsed.userId).toBe(targetUser.id);
    expect(parsed.roles).toHaveLength(2);
    expect(parsed.roles.map((r) => r.code).sort()).toEqual(['PROGRAM_DIRECTOR', 'TEACHER']);

    // CA1: unión de permisos efectivos
    expect(parsed.effectivePermissions.length).toBeGreaterThan(0);
    expect(parsed.effectivePermissions.some((p) => p.permissionCode === 'academico.ver')).toBe(
      true,
    );

    // Auditoría ROLE_CHANGE
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'User',
        entityId: targetUser.id,
        action: 'ROLE_CHANGE',
      },
    });

    expect(auditLogs).toHaveLength(1);
    const log = auditLogs[0]!;
    expect(log.actor).toBe(adminActor.user.id);

    const before =
      typeof log.before === 'string'
        ? (JSON.parse(log.before) as { roles: { code: string }[] })
        : (log.before as unknown as { roles: { code: string }[] });
    const after =
      typeof log.after === 'string'
        ? (JSON.parse(log.after) as { roles: { code: string }[] })
        : (log.after as unknown as { roles: { code: string }[] });
    expect(before.roles).toEqual([]);
    expect(after.roles.map((r: { code: string }) => r.code).sort()).toEqual([
      'PROGRAM_DIRECTOR',
      'TEACHER',
    ]);

    // Sin datos personales en la auditoría
    expect(before).not.toHaveProperty('email');
    expect(before).not.toHaveProperty('passwordHash');
    expect(before).not.toHaveProperty('dni');
    expect(after).not.toHaveProperty('email');
    expect(after).not.toHaveProperty('passwordHash');
    expect(after).not.toHaveProperty('dni');

    // Idempotencia: enviar el mismo payload responde 200 y no genera un segundo registro de auditoría
    const repeatResponse = await request(app)
      .put(`/users/${targetUser.id}/roles`)
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: [teacherRole.id, directorRole.id] });

    expect(repeatResponse.status).toBe(200);
    const auditLogsAfterRepeat = await prisma.auditLog.findMany({
      where: {
        entity: 'User',
        entityId: targetUser.id,
        action: 'ROLE_CHANGE',
      },
    });
    expect(auditLogsAfterRepeat).toHaveLength(1);
  });

  it('rejects with 400 when roleIds is empty, has duplicates, exceeds 10 items, or has extra fields', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('validation_test');
    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });

    // roleIds vacío
    const resEmpty = await request(app)
      .put(`/users/${targetUser.id}/roles`)
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: [] });
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

    // roleIds con duplicados
    const resDup = await request(app)
      .put(`/users/${targetUser.id}/roles`)
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: [teacherRole.id, teacherRole.id] });
    expect(resDup.status).toBe(400);
    expect(resDup.body.error.code).toBe('VALIDATION_ERROR');

    // roleIds con más de 10 elementos
    const elevenIds = Array.from({ length: 11 }, (_, i) => `role-id-${i}`);
    const resEleven = await request(app)
      .put(`/users/${targetUser.id}/roles`)
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: elevenIds });
    expect(resEleven.status).toBe(400);
    expect(resEleven.body.error.code).toBe('VALIDATION_ERROR');

    // campo extra en body
    const resExtra = await request(app)
      .put(`/users/${targetUser.id}/roles`)
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: [teacherRole.id], extraField: true });
    expect(resExtra.status).toBe(400);
    expect(resExtra.body.error.code).toBe('VALIDATION_ERROR');

    // id de usuario de más de 64 caracteres
    const longUserId = 'a'.repeat(65);
    const resLongId = await request(app)
      .put(`/users/${longUserId}/roles`)
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: [teacherRole.id] });
    expect(resLongId.status).toBe(400);
    expect(resLongId.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects with 400 when a role does not exist or assigning a new inactive role', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('business_val');

    // Rol inexistente
    const resNonExistent = await request(app)
      .put(`/users/${targetUser.id}/roles`)
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: ['cuid_non_existent_role_123'] });
    expect(resNonExistent.status).toBe(400);
    expect(resNonExistent.body.error.code).toBe('VALIDATION_ERROR');

    // Rol inactivo nuevo
    const inactiveRole = await createRoleWithGrants(prisma, {
      name: 'Rol Inactivo Nuevo',
      status: 'INACTIVE',
    });

    const resInactive = await request(app)
      .put(`/users/${targetUser.id}/roles`)
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: [inactiveRole.id] });
    expect(resInactive.status).toBe(400);
    expect(resInactive.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when token is missing', async () => {
    const targetUser = await createTargetUser('auth_test');
    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });

    const response = await request(app)
      .put(`/users/${targetUser.id}/roles`)
      .send({ roleIds: [teacherRole.id] });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when user lacks usuario.editar permission', async () => {
    // Un docente no tiene permiso usuario.editar
    const teacherActor = await createActor(['TEACHER']);
    const targetUser = await createTargetUser('forbidden_test');
    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });

    const response = await request(app)
      .put(`/users/${targetUser.id}/roles`)
      .set('Authorization', teacherActor.authHeader)
      .send({ roleIds: [teacherRole.id] });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when target user does not exist', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });

    const response = await request(app)
      .put('/users/cuid_non_existent_user_123/roles')
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: [teacherRole.id] });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 when attempting to remove the ADMINISTRATOR role from the last active administrator (D8)', async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });

    // Aseguramos que solo exista un usuario activo con ADMINISTRATOR
    await prisma.userRole.deleteMany({ where: { roleId: adminRole.id } });

    const soleAdmin = await createActor(['ADMINISTRATOR']);

    // Intentamos quitar el rol ADMINISTRATOR al único administrador
    const response = await request(app)
      .put(`/users/${soleAdmin.user.id}/roles`)
      .set('Authorization', soleAdmin.authHeader)
      .send({ roleIds: [teacherRole.id] });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('applies a role change on the next request through the cache invalidation', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const testUser = await createActor([]); // Sin roles

    // 1. Con sus credenciales actuales no puede ver roles (403)
    const initialCheck = await request(app).get('/roles').set('Authorization', testUser.authHeader);
    expect(initialCheck.status).toBe(403);

    // 2. El administrador le asigna el rol ADMINISTRATOR
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    const assignRes = await request(app)
      .put(`/users/${testUser.user.id}/roles`)
      .set('Authorization', adminActor.authHeader)
      .send({ roleIds: [adminRole.id] });
    expect(assignRes.status).toBe(200);

    // 3. En la siguiente petición inmediata, la caché invalidada permite el acceso
    const nextCheck = await request(app).get('/roles').set('Authorization', testUser.authHeader);
    expect(nextCheck.status).toBe(200);
  });

  it('keeps one active administrator when two administrators remove each other at the same time (concurrency)', async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });

    // Limpiamos otros admins para dejar exactamente 2 admins activos
    await prisma.userRole.deleteMany({ where: { roleId: adminRole.id } });

    const adminA = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: ['ADMINISTRATOR'],
    });
    const adminB = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: ['ADMINISTRATOR'],
    });

    // adminA intenta quitar el rol a adminB y adminB intenta quitar el rol a adminA simultáneamente
    const [resultA, resultB] = await Promise.all([
      request(app)
        .put(`/users/${adminB.user.id}/roles`)
        .set('Authorization', adminA.authHeader)
        .send({ roleIds: [teacherRole.id] }),
      request(app)
        .put(`/users/${adminA.user.id}/roles`)
        .set('Authorization', adminB.authHeader)
        .send({ roleIds: [teacherRole.id] }),
    ]);

    const statuses = [resultA.status, resultB.status].sort();
    // Uno debe ser 200 y el otro 409 (candado del último administrador activo)
    expect(statuses).toEqual([200, 409]);

    // Comprobamos que en base de datos queda exactamente 1 administrador activo
    const remainingAdmins = await prisma.userRole.count({
      where: { roleId: adminRole.id, user: { status: 'ACTIVE' } },
    });
    expect(remainingAdmins).toBe(1);
  });
}, 30_000);
