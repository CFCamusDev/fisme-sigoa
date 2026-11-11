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

describe('PUT /users/:id/permissions HTTP Routes Integration (PostgreSQL real, HU-007, T-007-25, CA2, RF-007, RS-002, RS-012, RS-013, RS-020, RNF-009, RNF-017, RNF-022, D1, D3, D4, D5, D6, D7, D9)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-user-permissions-routes-test',
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

  it('replaces direct permissions, returns 200 with UserAccessDto, and records PERMISSION_CHANGE audit with before and after', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('assign_perms');

    const response = await request(app)
      .put(`/users/${targetUser.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [
          { permissionCode: 'academico.editar', scope: 'GLOBAL' },
          { permissionCode: 'matriz.ver', scope: 'OWN' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const parsed = userAccessSchema.parse(response.body);
    expect(parsed.userId).toBe(targetUser.id);
    expect(parsed.directPermissions).toHaveLength(2);
    expect(parsed.directPermissions.map((p) => p.permissionCode).sort()).toEqual([
      'academico.editar',
      'matriz.ver',
    ]);

    // Verificar fuentes en effectivePermissions
    const directEffective = parsed.effectivePermissions.find(
      (p) => p.permissionCode === 'academico.editar',
    );
    expect(directEffective).toBeDefined();
    expect(directEffective?.sources).toEqual([{ kind: 'DIRECT', scope: 'GLOBAL' }]);

    // Auditoría PERMISSION_CHANGE
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'User',
        entityId: targetUser.id,
        action: 'PERMISSION_CHANGE',
      },
    });

    expect(auditLogs).toHaveLength(1);
    const log = auditLogs[0]!;
    expect(log.actor).toBe(adminActor.user.id);

    const before =
      typeof log.before === 'string'
        ? (JSON.parse(log.before) as { permissions: { permissionCode: string; scope: string }[] })
        : (log.before as unknown as { permissions: { permissionCode: string; scope: string }[] });
    const after =
      typeof log.after === 'string'
        ? (JSON.parse(log.after) as { permissions: { permissionCode: string; scope: string }[] })
        : (log.after as unknown as { permissions: { permissionCode: string; scope: string }[] });

    expect(before.permissions).toEqual([]);
    expect(after.permissions.map((p) => p.permissionCode).sort()).toEqual([
      'academico.editar',
      'matriz.ver',
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
      .put(`/users/${targetUser.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [
          { permissionCode: 'academico.editar', scope: 'GLOBAL' },
          { permissionCode: 'matriz.ver', scope: 'OWN' },
        ],
      });

    expect(repeatResponse.status).toBe(200);
    const auditLogsAfterRepeat = await prisma.auditLog.findMany({
      where: {
        entity: 'User',
        entityId: targetUser.id,
        action: 'PERMISSION_CHANGE',
      },
    });
    expect(auditLogsAfterRepeat).toHaveLength(1);
  });

  it('allows passing permissions: [] to revoke all direct permissions', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('empty_perms');

    // Asignamos inicialmente un permiso
    await request(app)
      .put(`/users/${targetUser.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'academico.editar', scope: 'GLOBAL' }],
      });

    // Revocamos todos enviando lista vacía
    const response = await request(app)
      .put(`/users/${targetUser.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({ permissions: [] });

    expect(response.status).toBe(200);
    const parsed = userAccessSchema.parse(response.body);
    expect(parsed.directPermissions).toEqual([]);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'User',
        entityId: targetUser.id,
        action: 'PERMISSION_CHANGE',
      },
      orderBy: { occurredAt: 'asc' },
    });

    expect(auditLogs).toHaveLength(2);
    const lastLog = auditLogs[1]!;
    const after =
      typeof lastLog.after === 'string'
        ? (JSON.parse(lastLog.after) as { permissions: unknown[] })
        : (lastLog.after as unknown as { permissions: unknown[] });
    expect(after.permissions).toEqual([]);
  });

  it('CA2: direct permission with scope OWN does not pass a GLOBAL route, but scope GLOBAL passes immediately on next request', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    // Creamos un usuario sin roles
    const testUser = await createActor([]);

    // 1. Inicialmente no puede ver usuarios (403)
    const initialCheck = await request(app).get('/users').set('Authorization', testUser.authHeader);
    expect(initialCheck.status).toBe(403);

    // 2. El administrador le asigna permiso directo 'usuario.ver' con alcance OWN
    const assignOwnRes = await request(app)
      .put(`/users/${testUser.user.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' }],
      });
    expect(assignOwnRes.status).toBe(200);

    // 3. La siguiente petición a /users (que requiere 'usuario.ver' GLOBAL) sigue devolviendo 403 (CA2)
    const checkAfterOwn = await request(app)
      .get('/users')
      .set('Authorization', testUser.authHeader);
    expect(checkAfterOwn.status).toBe(403);

    // 4. El administrador le actualiza el permiso a alcance GLOBAL
    const assignGlobalRes = await request(app)
      .put(`/users/${testUser.user.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'usuario.ver', scope: 'GLOBAL' }],
      });
    expect(assignGlobalRes.status).toBe(200);

    // 5. La siguiente petición inmediata ahora sí devuelve 200 (CA2 + invalidación de caché)
    const checkAfterGlobal = await request(app)
      .get('/users')
      .set('Authorization', testUser.authHeader);
    expect(checkAfterGlobal.status).toBe(200);
  });

  it('rejects with 400 when permissions has duplicates, unknown codes, invalid scope, exceeds 200 items, or extra fields', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('perm_val');

    // Duplicados
    const resDup = await request(app)
      .put(`/users/${targetUser.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [
          { permissionCode: 'academico.editar', scope: 'GLOBAL' },
          { permissionCode: 'academico.editar', scope: 'OWN' },
        ],
      });
    expect(resDup.status).toBe(400);
    expect(resDup.body.error.code).toBe('VALIDATION_ERROR');

    // Código fuera del catálogo
    const resUnknownCode = await request(app)
      .put(`/users/${targetUser.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'codigo.inexistente', scope: 'GLOBAL' }],
      });
    expect(resUnknownCode.status).toBe(400);
    expect(resUnknownCode.body.error.code).toBe('VALIDATION_ERROR');

    // Alcance inválido
    const resInvalidScope = await request(app)
      .put(`/users/${targetUser.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'academico.editar', scope: 'SUPER_GLOBAL' }],
      });
    expect(resInvalidScope.status).toBe(400);
    expect(resInvalidScope.body.error.code).toBe('VALIDATION_ERROR');

    // Más de 200 elementos
    const twoHundredOneGrants = Array.from({ length: 201 }, (_, i) => ({
      permissionCode: `perm.${i}`,
      scope: 'GLOBAL',
    }));
    const resOver200 = await request(app)
      .put(`/users/${targetUser.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({ permissions: twoHundredOneGrants });
    expect(resOver200.status).toBe(400);
    expect(resOver200.body.error.code).toBe('VALIDATION_ERROR');

    // Campo extra en body
    const resExtraField = await request(app)
      .put(`/users/${targetUser.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [],
        extraProperty: true,
      });
    expect(resExtraField.status).toBe(400);
    expect(resExtraField.body.error.code).toBe('VALIDATION_ERROR');

    // ID de usuario con más de 64 caracteres
    const longId = 'x'.repeat(65);
    const resLongId = await request(app)
      .put(`/users/${longId}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({ permissions: [] });
    expect(resLongId.status).toBe(400);
    expect(resLongId.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when token is missing', async () => {
    const targetUser = await createTargetUser('no_auth');

    const response = await request(app)
      .put(`/users/${targetUser.id}/permissions`)
      .send({ permissions: [] });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when user has usuario.editar but lacks permiso.asignar (D6)', async () => {
    // Creamos un rol que solo otorga usuario.editar (GLOBAL)
    const customRole = await createRoleWithGrants(prisma, {
      name: 'Editor de Usuarios Sin Asignar Permisos',
      grants: [{ permissionCode: 'usuario.editar', scope: 'GLOBAL' }],
    });

    const editorActor = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: [customRole.code],
    });

    const targetUser = await createTargetUser('forbidden_perm');

    // Puede editar roles si quisiera, pero para PUT /users/:id/permissions requiere permiso.asignar
    const response = await request(app)
      .put(`/users/${targetUser.id}/permissions`)
      .set('Authorization', editorActor.authHeader)
      .send({ permissions: [] });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when target user does not exist', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .put('/users/cuid_non_existent_target_user/permissions')
      .set('Authorization', adminActor.authHeader)
      .send({ permissions: [] });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('serializes two simultaneous replacements of direct permissions for the same user (concurrency)', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const targetUser = await createTargetUser('concurrent_perm');

    const payloadA = [{ permissionCode: 'academico.editar', scope: 'GLOBAL' as const }];
    const payloadB = [{ permissionCode: 'matriz.ver', scope: 'OWN' as const }];

    // Dos peticiones simultáneas sobre el mismo usuario
    const [resA, resB] = await Promise.all([
      request(app)
        .put(`/users/${targetUser.id}/permissions`)
        .set('Authorization', adminActor.authHeader)
        .send({ permissions: payloadA }),
      request(app)
        .put(`/users/${targetUser.id}/permissions`)
        .set('Authorization', adminActor.authHeader)
        .send({ permissions: payloadB }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    // El estado final en BD debe ser consistente: exactamente uno de los dos conjuntos asignado
    const directPerms = await prisma.userPermission.findMany({
      where: { userId: targetUser.id },
      include: { permission: true },
    });

    expect(directPerms).toHaveLength(1);
    const assignedCode = directPerms[0]!.permission.code;
    expect(['academico.editar', 'matriz.ver']).toContain(assignedCode);
  });
}, 30_000);
