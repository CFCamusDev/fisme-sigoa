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
  seedAuthorization,
  createRoleWithGrants,
} from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('PUT /roles/:id/permissions HTTP Routes Integration (PostgreSQL real, HU-006, T-006-31, CA2, RF-006, RS-002, RS-020, RNF-007, RNF-008, RNF-009, RNF-017, RNF-030)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-roles-permissions-test',
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

  it('replaces the permissions of a role and audits before and after', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const customRole = await createRoleWithGrants(prisma, {
      name: 'Comité de Acreditación',
      grants: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    });

    const payload = {
      permissions: [
        { permissionCode: 'rol.ver', scope: 'GLOBAL' as const },
        { permissionCode: 'rol.editar', scope: 'GLOBAL' as const },
      ],
    };

    const res = await request(app)
      .put(`/roles/${customRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');

    const parsed = roleDtoSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);

    expect(res.body.id).toBe(customRole.id);
    expect(res.body.permissions).toHaveLength(2);
    const codes = res.body.permissions.map((p: { permissionCode: string }) => p.permissionCode);
    expect(codes).toContain('rol.ver');
    expect(codes).toContain('rol.editar');

    // Verificación en base de datos PostgreSQL real
    const dbRolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: customRole.id },
      include: { permission: true },
    });
    expect(dbRolePermissions).toHaveLength(2);

    // Verificación en auditoría de PERMISSION_CHANGE
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entity: 'Role',
        entityId: customRole.id,
        action: 'PERMISSION_CHANGE',
      },
      orderBy: { sequence: 'desc' },
    });

    expect(auditLog).not.toBeNull();
    expect(auditLog?.actor).toBe(adminActor.user.id);
    expect(auditLog?.before).toBeDefined();
    expect(auditLog?.after).toBeDefined();
  });

  it('applies the new permissions on the next request of the role users (CA2)', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const teacherActor = await createActor(['TEACHER']);

    // 1. El usuario docente intenta acceder a /users y recibe 403 (TEACHER por defecto no tiene usuario.ver)
    const initialTeacherRes = await request(app)
      .get('/users')
      .set('Authorization', teacherActor.authHeader);
    expect(initialTeacherRes.status).toBe(403);

    // 2. Obtener el id del rol TEACHER
    const teacherRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'TEACHER' },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    // Guardar los permisos originales de TEACHER para restaurar o ampliar
    const currentGrants = teacherRole.rolePermissions.map((rp) => ({
      permissionCode: rp.permission.code,
      scope: rp.scope as 'GLOBAL' | 'OWN',
    }));

    // El Administrador le concede 'usuario.ver' con alcance GLOBAL al rol TEACHER
    const updateRes = await request(app)
      .put(`/roles/${teacherRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [
          ...currentGrants,
          { permissionCode: 'usuario.ver', scope: 'GLOBAL' as const },
        ],
      });
    expect(updateRes.status).toBe(200);

    // 3. El docente repite la petición a /users con el MISMO TOKEN sin reiniciar sesión
    const updatedTeacherRes = await request(app)
      .get('/users')
      .set('Authorization', teacherActor.authHeader);
    expect(updatedTeacherRes.status).toBe(200);

    // 4. El Administrador retira el permiso 'usuario.ver' nuevamente
    const revokeRes = await request(app)
      .put(`/roles/${teacherRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: currentGrants,
      });
    expect(revokeRes.status).toBe(200);

    // 5. El mismo token del docente vuelve a recibir 403 inmediatamente
    const finalTeacherRes = await request(app)
      .get('/users')
      .set('Authorization', teacherActor.authHeader);
    expect(finalTeacherRes.status).toBe(403);
  });

  it('changes a permission scope from global to own', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const customRole = await createRoleWithGrants(prisma, {
      name: 'Supervisor de Programa',
      grants: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    });

    const res = await request(app)
      .put(`/roles/${customRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'rol.ver', scope: 'OWN' as const }],
      });

    expect(res.status).toBe(200);
    expect(res.body.permissions).toEqual([{ permissionCode: 'rol.ver', scope: 'OWN' }]);

    const dbPermission = await prisma.rolePermission.findFirst({
      where: { roleId: customRole.id },
    });
    expect(dbPermission?.scope).toBe('OWN');
  });

  it('accepts an empty permission list for a custom role', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const customRole = await createRoleWithGrants(prisma, {
      name: 'Rol de Consulta Inicial',
      grants: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    });

    const res = await request(app)
      .put(`/roles/${customRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.permissions).toEqual([]);

    const dbRolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: customRole.id },
    });
    expect(dbRolePermissions).toHaveLength(0);
  });

  it('a repeated identical request returns 200 and writes no new audit entry (idempotency)', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const customRole = await createRoleWithGrants(prisma, {
      name: 'Rol Idempotente',
      grants: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    });

    const payload = {
      permissions: [
        { permissionCode: 'rol.ver', scope: 'GLOBAL' as const },
        { permissionCode: 'rol.editar', scope: 'GLOBAL' as const },
      ],
    };

    // Primera invocación
    const res1 = await request(app)
      .put(`/roles/${customRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send(payload);
    expect(res1.status).toBe(200);

    const auditCount1 = await prisma.auditLog.count({
      where: { entity: 'Role', entityId: customRole.id },
    });
    expect(auditCount1).toBe(1);

    // Segunda invocación idéntica
    const res2 = await request(app)
      .put(`/roles/${customRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send(payload);
    expect(res2.status).toBe(200);

    const auditCount2 = await prisma.auditLog.count({
      where: { entity: 'Role', entityId: customRole.id },
    });
    expect(auditCount2).toBe(1); // No incrementó
  });

  it('returns 400 for a role id longer than 64 characters', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const tooLongId = 'a'.repeat(65);
    const res = await request(app)
      .put(`/roles/${tooLongId}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for repeated codes, unknown codes and unknown keys', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const customRole = await createRoleWithGrants(prisma, {
      name: 'Rol Validaciones',
      grants: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    });

    // 1. Códigos duplicados
    const dupRes = await request(app)
      .put(`/roles/${customRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [
          { permissionCode: 'rol.ver', scope: 'GLOBAL' },
          { permissionCode: 'rol.ver', scope: 'OWN' },
        ],
      });
    expect(dupRes.status).toBe(400);
    expect(dupRes.body.error.code).toBe('VALIDATION_ERROR');

    // 2. Código desconocido fuera del catálogo
    const unknownRes = await request(app)
      .put(`/roles/${customRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'permiso.inexistente', scope: 'GLOBAL' }],
      });
    expect(unknownRes.status).toBe(400);
    expect(unknownRes.body.error.code).toBe('VALIDATION_ERROR');

    // 3. Propiedades desconocidas en el cuerpo
    const unknownKeysRes = await request(app)
      .put(`/roles/${customRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
        extraProp: 'forbidden',
      });
    expect(unknownKeysRes.status).toBe(400);
    expect(unknownKeysRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .put('/roles/role-id-test/permissions')
      .send({
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 without rol.editar and does not read role', async () => {
    const committeeActor = await createActor(['COMMITTEE_MEMBER']);

    // Probar incluso con un rol que no existe; el 403 debe ocurrir antes del 404 (D5)
    const res = await request(app)
      .put('/roles/role-that-does-not-exist/permissions')
      .set('Authorization', committeeActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for an unknown role', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const res = await request(app)
      .put('/roles/non-existent-role-uuid/permissions')
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 when the administrator role would lose rol.ver or rol.editar', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMINISTRATOR' },
    });

    // Intentar dejar al administrador sin rol.editar
    const res = await request(app)
      .put(`/roles/${adminRole.id}/permissions`)
      .set('Authorization', adminActor.authHeader)
      .send({
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' as const }],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it(
    'serializes two concurrent PUT requests and leaves one coherent final set',
    { timeout: 20_000 },
    async () => {
      const adminActor = await createActor(['ADMINISTRATOR']);

      const customRole = await createRoleWithGrants(prisma, {
        name: 'Rol Concurrente',
        grants: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      });

      const setA = [
        { permissionCode: 'rol.ver', scope: 'GLOBAL' as const },
        { permissionCode: 'rol.editar', scope: 'GLOBAL' as const },
      ];

      const setB = [
        { permissionCode: 'usuario.ver', scope: 'GLOBAL' as const },
        { permissionCode: 'usuario.crear', scope: 'GLOBAL' as const },
      ];

      const [res1, res2] = await Promise.all([
        request(app)
          .put(`/roles/${customRole.id}/permissions`)
          .set('Authorization', adminActor.authHeader)
          .send({ permissions: setA }),
        request(app)
          .put(`/roles/${customRole.id}/permissions`)
          .set('Authorization', adminActor.authHeader)
          .send({ permissions: setB }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // El estado final en BD debe ser exactamente o bien setA o bien setB, nunca una mezcla parcial
      const finalDbPermissions = await prisma.rolePermission.findMany({
        where: { roleId: customRole.id },
        include: { permission: true },
      });

      const finalCodes = finalDbPermissions.map((p) => p.permission.code).sort();
      const isSetA = JSON.stringify(finalCodes) === JSON.stringify(['rol.editar', 'rol.ver']);
      const isSetB =
        JSON.stringify(finalCodes) === JSON.stringify(['usuario.crear', 'usuario.ver']);

      expect(isSetA || isSetB).toBe(true);

      // Verificación de auditoría encadenada
      const audits = await prisma.auditLog.findMany({
        where: {
          entity: 'Role',
          entityId: customRole.id,
          action: 'PERMISSION_CHANGE',
        },
        orderBy: { sequence: 'asc' },
      });
      expect(audits.length).toBeGreaterThanOrEqual(1);
    },
  );
});
