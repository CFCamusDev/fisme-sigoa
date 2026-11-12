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
  seedAuthorizationFast,
  createRoleWithGrants,
} from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('GET /users/:id/effective-permissions HTTP Routes Integration (PostgreSQL real, HU-007, T-007-26, CA1, RF-007, RS-002, RS-012, RS-013, RS-020, RNF-009, RNF-017, D1, D6, D7, D9)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-user-effective-access-routes-test',
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
    await seedAuthorizationFast(prisma);
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

  it('CA1: returns consolidated union of permissions with sources for user with 2 roles and 1 direct permission', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('effective_ca1');

    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
    const directorRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'PROGRAM_DIRECTOR' },
    });

    // 1. Asignamos dos roles
    await prisma.userRole.createMany({
      data: [
        { userId: targetUser.id, roleId: teacherRole.id, createdBy: adminActor.user.id },
        { userId: targetUser.id, roleId: directorRole.id, createdBy: adminActor.user.id },
      ],
    });

    // 2. Asignamos un permiso directo (academico.editar GLOBAL)
    const directPerm = await prisma.permission.findUniqueOrThrow({
      where: { code: 'academico.editar' },
    });
    await prisma.userPermission.create({
      data: {
        userId: targetUser.id,
        permissionId: directPerm.id,
        scope: 'GLOBAL',
        createdBy: adminActor.user.id,
      },
    });

    // 3. Consultamos permisos efectivos
    const response = await request(app)
      .get(`/users/${targetUser.id}/effective-permissions`)
      .set('Authorization', adminActor.authHeader);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const parsed = userAccessSchema.parse(response.body);
    expect(parsed.userId).toBe(targetUser.id);
    expect(parsed.roles).toHaveLength(2);
    expect(parsed.roles.map((r) => r.code).sort()).toEqual(['PROGRAM_DIRECTOR', 'TEACHER']);

    expect(parsed.directPermissions).toHaveLength(1);
    expect(parsed.directPermissions[0]).toEqual({
      permissionCode: 'academico.editar',
      scope: 'GLOBAL',
    });

    // CA1: Unión consolidada de permisos
    expect(parsed.effectivePermissions.length).toBeGreaterThan(0);

    // Permiso proveniente del rol TEACHER / DIRECTOR
    const acadVer = parsed.effectivePermissions.find((p) => p.permissionCode === 'academico.ver');
    expect(acadVer).toBeDefined();
    expect(acadVer?.sources.some((s) => s.kind === 'ROLE')).toBe(true);

    // Permiso proveniente del directo
    const acadEdit = parsed.effectivePermissions.find(
      (p) => p.permissionCode === 'academico.editar',
    );
    expect(acadEdit).toBeDefined();
    expect(acadEdit?.sources.some((s) => s.kind === 'DIRECT')).toBe(true);

    // La respuesta no expone datos sensibles
    const rawBody = response.body as Record<string, unknown>;
    expect(rawBody).not.toHaveProperty('email');
    expect(rawBody).not.toHaveProperty('passwordHash');
    expect(rawBody).not.toHaveProperty('dni');
  });

  it('returns empty lists for a user with no roles and no direct permissions', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('empty_access');

    const response = await request(app)
      .get(`/users/${targetUser.id}/effective-permissions`)
      .set('Authorization', adminActor.authHeader);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const parsed = userAccessSchema.parse(response.body);
    expect(parsed.userId).toBe(targetUser.id);
    expect(parsed.roles).toEqual([]);
    expect(parsed.directPermissions).toEqual([]);
    expect(parsed.effectivePermissions).toEqual([]);
  });

  it('lists an assigned inactive role in roles but does not contribute its permissions to effectivePermissions', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('inactive_role_target');

    // Creamos un rol inactivo con un permiso exclusivo
    const inactiveRole = await createRoleWithGrants(prisma, {
      name: 'Rol Inactivo Para Efectivo',
      status: 'INACTIVE',
      grants: [{ permissionCode: 'catalogo.editar', scope: 'GLOBAL' }],
    });

    // Lo asignamos directamente en BD
    await prisma.userRole.create({
      data: {
        userId: targetUser.id,
        roleId: inactiveRole.id,
        createdBy: adminActor.user.id,
      },
    });

    const response = await request(app)
      .get(`/users/${targetUser.id}/effective-permissions`)
      .set('Authorization', adminActor.authHeader);

    expect(response.status).toBe(200);
    const parsed = userAccessSchema.parse(response.body);

    // El rol inactivo aparece en la lista de roles del usuario con status INACTIVE
    expect(parsed.roles).toHaveLength(1);
    expect(parsed.roles[0]!.id).toBe(inactiveRole.id);
    expect(parsed.roles[0]!.status).toBe('INACTIVE');

    // Pero no aporta permisos efectivos
    expect(parsed.effectivePermissions).toEqual([]);
  });

  it('rejects with 400 when user id in path exceeds 64 characters', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const longId = 'y'.repeat(65);

    const response = await request(app)
      .get(`/users/${longId}/effective-permissions`)
      .set('Authorization', adminActor.authHeader);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects with 400 when query parameters are supplied (noQuerySchema violation)', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('query_violation');

    const response = await request(app)
      .get(`/users/${targetUser.id}/effective-permissions?unexpected=true`)
      .set('Authorization', adminActor.authHeader);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when token is missing', async () => {
    const targetUser = await createTargetUser('no_token');

    const response = await request(app).get(`/users/${targetUser.id}/effective-permissions`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when authenticated user lacks usuario.ver permission', async () => {
    // Usuario sin roles ni permisos
    const testUser = await createActor([]);
    const targetUser = await createTargetUser('forbidden_target');

    const response = await request(app)
      .get(`/users/${targetUser.id}/effective-permissions`)
      .set('Authorization', testUser.authHeader);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when target user does not exist', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .get('/users/cuid_non_existent_target_user/effective-permissions')
      .set('Authorization', adminActor.authHeader);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
}, 30_000);
