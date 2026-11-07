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
  seedAuthorization,
} from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('PATCH /roles/:id HTTP Routes Integration (PostgreSQL real, HU-006, T-006-30, RF-006, RS-002, RS-020, RNF-009, RNF-017)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-roles-update-test',
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

  it('renames a role and audits an UPDATE', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);
    const initialName = `Rol Inicial ${suffix}`;
    const newName = `Rol Modificado ${suffix}`;

    const role = await createRoleWithGrants(prisma, {
      name: initialName,
      description: 'Descripción previa',
    });

    const res = await request(app)
      .patch(`/roles/${role.id}`)
      .set('Authorization', adminActor.authHeader)
      .send({
        name: newName,
        description: 'Descripción actualizada',
      });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');

    const parsed = roleDtoSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
    expect(res.body.name).toBe(newName);
    expect(res.body.description).toBe('Descripción actualizada');

    // Verificar persistencia
    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
    expect(inDb.name).toBe(newName);
    expect(inDb.description).toBe('Descripción actualizada');
    expect(inDb.updatedBy).toBe(adminActor.user.id);

    // Verificar auditoría
    const auditEntries = await prisma.auditLog.findMany({
      where: {
        entity: 'Role',
        entityId: role.id,
        action: 'UPDATE',
      },
    });
    expect(auditEntries).toHaveLength(1);
    const audit = auditEntries[0]!;
    expect(audit.actor).toBe(adminActor.user.id);
    expect((audit.before as Record<string, unknown>).name).toBe(initialName);
    expect((audit.after as Record<string, unknown>).name).toBe(newName);
  });

  it('updates only the description without altering the name', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);
    const roleName = `Rol Solo Desc ${suffix}`;

    const role = await createRoleWithGrants(prisma, {
      name: roleName,
      description: 'Antes',
    });

    const res = await request(app)
      .patch(`/roles/${role.id}`)
      .set('Authorization', adminActor.authHeader)
      .send({
        description: 'Después',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(roleName);
    expect(res.body.description).toBe('Después');

    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
    expect(inDb.name).toBe(roleName);
    expect(inDb.description).toBe('Después');
  });

  it('clears the description when null is sent', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);
    const role = await createRoleWithGrants(prisma, {
      name: `Rol Limpiar Desc ${suffix}`,
      description: 'Descripción que se borrará',
    });

    const res = await request(app)
      .patch(`/roles/${role.id}`)
      .set('Authorization', adminActor.authHeader)
      .send({
        description: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.description).toBeNull();

    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
    expect(inDb.description).toBeNull();
  });

  it('returns 400 for an empty body, unknown keys, short or long names', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);
    const role = await createRoleWithGrants(prisma, {
      name: `Rol Validaciones ${suffix}`,
    });

    // 1. Cuerpo vacío
    const emptyRes = await request(app)
      .patch(`/roles/${role.id}`)
      .set('Authorization', adminActor.authHeader)
      .send({});
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.error.code).toBe('VALIDATION_ERROR');

    // 2. Clave desconocida
    const unknownRes = await request(app)
      .patch(`/roles/${role.id}`)
      .set('Authorization', adminActor.authHeader)
      .send({ name: 'Nombre Válido', code: 'INVALID_FIELD' });
    expect(unknownRes.status).toBe(400);
    expect(unknownRes.body.error.code).toBe('VALIDATION_ERROR');

    // 3. Nombre demasiado corto (< 3)
    const shortRes = await request(app)
      .patch(`/roles/${role.id}`)
      .set('Authorization', adminActor.authHeader)
      .send({ name: 'ab' });
    expect(shortRes.status).toBe(400);
    expect(shortRes.body.error.code).toBe('VALIDATION_ERROR');

    // 4. Nombre demasiado largo (> 80)
    const longRes = await request(app)
      .patch(`/roles/${role.id}`)
      .set('Authorization', adminActor.authHeader)
      .send({ name: 'x'.repeat(81) });
    expect(longRes.status).toBe(400);
    expect(longRes.body.error.code).toBe('VALIDATION_ERROR');

    // 5. Descripción demasiado larga (> 255)
    const longDescRes = await request(app)
      .patch(`/roles/${role.id}`)
      .set('Authorization', adminActor.authHeader)
      .send({ description: 'x'.repeat(256) });
    expect(longDescRes.status).toBe(400);
    expect(longDescRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for a role id longer than 64 characters', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const res = await request(app)
      .patch(`/roles/${'x'.repeat(65)}`)
      .set('Authorization', adminActor.authHeader)
      .send({ name: 'Nuevo Nombre Válido' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).patch('/roles/any-role-id').send({ name: 'Cualquier Nombre' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 without rol.editar and writes nothing', async () => {
    // Usuario sin rol con rol.editar
    const unauthorizedActor = await createActor([]);
    const suffix = Date.now().toString().slice(-4);
    const initialName = `Rol No Tocado ${suffix}`;
    const role = await createRoleWithGrants(prisma, {
      name: initialName,
    });

    const res = await request(app)
      .patch(`/roles/${role.id}`)
      .set('Authorization', unauthorizedActor.authHeader)
      .send({ name: 'Nombre Que No Debe Cambiar' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    // Asegurar que no hubo cambios en BD
    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
    expect(inDb.name).toBe(initialName);

    // Sin auditoría
    const auditCount = await prisma.auditLog.count({
      where: { entity: 'Role', entityId: role.id, action: 'UPDATE' },
    });
    expect(auditCount).toBe(0);
  });

  it('returns 404 for an unknown role', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const res = await request(app)
      .patch('/roles/role-that-does-not-exist')
      .set('Authorization', adminActor.authHeader)
      .send({ name: 'Nombre Para Rol Inexistente' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 for a name used by another role ignoring case', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);
    const suffix = Date.now().toString().slice(-4);
    const existingName = `Auditor Líder ${suffix}`;

    await createRoleWithGrants(prisma, {
      name: existingName,
    });

    const roleToEdit = await createRoleWithGrants(prisma, {
      name: `Auditor Secundario ${suffix}`,
    });

    // Intentar renombrar con diferente casing
    const res = await request(app)
      .patch(`/roles/${roleToEdit.id}`)
      .set('Authorization', adminActor.authHeader)
      .send({ name: existingName.toLowerCase() });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');

    // Comprobar que en BD no cambió
    const inDb = await prisma.role.findUniqueOrThrow({ where: { id: roleToEdit.id } });
    expect(inDb.name).toBe(`Auditor Secundario ${suffix}`);
  });
});
