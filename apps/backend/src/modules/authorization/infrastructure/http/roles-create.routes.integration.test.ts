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
  seedAuthorizationFast,
  createRoleWithGrants,
} from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('POST /roles HTTP Routes Integration (PostgreSQL real, HU-006, T-006-30, RF-006, RS-002, RS-020, RNF-007, RNF-008, RNF-009, RNF-017, RNF-030)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-roles-create-test',
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

  it('creates a role with initial permissions and audits it', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const payload = {
      name: 'Auditor de Calidad',
      description: 'Responsable de auditar evidencias de los objetivos educacionales',
      permissions: [
        {
          permissionCode: 'rol.ver',
          scope: 'GLOBAL' as const,
        },
      ],
    };

    const res = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');

    const parsed = roleDtoSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);

    expect(res.body).toMatchObject({
      code: 'AUDITOR_DE_CALIDAD',
      name: 'Auditor de Calidad',
      description: 'Responsable de auditar evidencias de los objetivos educacionales',
      isPredefined: false,
      status: 'ACTIVE',
      userCount: 0,
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    });

    // Verificación en base de datos PostgreSQL real
    const dbRole = await prisma.role.findUnique({
      where: { id: res.body.id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
    expect(dbRole).not.toBeNull();
    expect(dbRole?.code).toBe('AUDITOR_DE_CALIDAD');
    expect(dbRole?.rolePermissions).toHaveLength(1);
    expect(dbRole?.rolePermissions[0]?.permission.code).toBe('rol.ver');

    // Verificación de auditoría CREATE
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        entity: 'Role',
        entityId: res.body.id,
        action: 'CREATE',
      },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.actor).toBe(adminActor.user.id);
  });

  it('creates a role with only a name (incomplete but valid)', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const payload = {
      name: 'Coordinador Auxiliar',
    };

    const res = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Coordinador Auxiliar');
    expect(res.body.code).toBe('COORDINADOR_AUXILIAR');
    expect(res.body.description).toBeNull();
    expect(res.body.permissions).toEqual([]);
    expect(roleDtoSchema.safeParse(res.body).success).toBe(true);
  });

  it('returns 400 for a name shorter than 3 or longer than 80 characters', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const resShort = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .send({ name: 'ab' });

    expect(resShort.status).toBe(400);
    expect(resShort.body.error.code).toBe('VALIDATION_ERROR');

    const resLong = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .send({ name: 'A'.repeat(81) });

    expect(resLong.status).toBe(400);
    expect(resLong.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for unknown keys such as code or status', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const res = await request(app).post('/roles').set('Authorization', adminActor.authHeader).send({
      name: 'Rol Hacker',
      code: 'HACKER_CODE',
      status: 'ACTIVE',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for an unknown permission code and creates nothing', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const res = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .send({
        name: 'Rol Invalido',
        permissions: [
          {
            permissionCode: 'permiso.inexistente_total',
            scope: 'GLOBAL',
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('permissions[0].permissionCode');

    // Comprobar que no se creó en base de datos
    const dbRole = await prisma.role.findFirst({
      where: { name: 'Rol Invalido' },
    });
    expect(dbRole).toBeNull();
  });

  it('returns 400 for repeated codes and for more than 200 permissions', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    // Códigos repetidos
    const resRepeated = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .send({
        name: 'Rol Repetido',
        permissions: [
          { permissionCode: 'rol.ver', scope: 'GLOBAL' },
          { permissionCode: 'rol.ver', scope: 'OWN' },
        ],
      });

    expect(resRepeated.status).toBe(400);

    // Más de 200 items
    const manyPermissions = Array.from({ length: 201 }, (_, i) => ({
      permissionCode: `permiso.code_${i}`,
      scope: 'GLOBAL' as const,
    }));

    const resOverflow = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .send({
        name: 'Rol Masivo',
        permissions: manyPermissions,
      });

    expect(resOverflow.status).toBe(400);
    expect(resOverflow.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for a malformed json body', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    const res = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .set('Content-Type', 'application/json')
      .send('{"name": "malformed json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/roles').send({ name: 'Sin Autenticacion' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 without rol.editar and writes nothing', async () => {
    // 1) Usuario con COMMITTEE_MEMBER (no tiene rol.editar)
    const committeeActor = await createActor(['COMMITTEE_MEMBER']);

    const resCommittee = await request(app)
      .post('/roles')
      .set('Authorization', committeeActor.authHeader)
      .send({ name: 'Rol Intruso' });

    expect(resCommittee.status).toBe(403);
    expect(resCommittee.body.error.code).toBe('FORBIDDEN');

    // 2) Usuario con rol que solo tiene rol.ver pero NO rol.editar
    const customRole = await createRoleWithGrants(prisma, {
      name: 'Solo Lector de Roles',
      grants: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    });

    const readOnlyActor = await createActor([customRole.code]);

    const resReadOnly = await request(app)
      .post('/roles')
      .set('Authorization', readOnlyActor.authHeader)
      .send({ name: 'Rol Intruso 2' });

    expect(resReadOnly.status).toBe(403);
    expect(resReadOnly.body.error.code).toBe('FORBIDDEN');

    // Verificar que no se escribió nada en BD ni en auditoría
    const dbRole = await prisma.role.findFirst({
      where: { name: { in: ['Rol Intruso', 'Rol Intruso 2'] } },
    });
    expect(dbRole).toBeNull();

    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        entity: 'Role',
        actor: { in: [committeeActor.user.id, readOnlyActor.user.id] },
      },
    });
    expect(auditEntry).toBeNull();
  });

  it('returns 409 for a duplicated name ignoring case and for a name equal to a predefined role', async () => {
    const adminActor = await createActor(['ADMINISTRATOR']);

    // 1) Crear primer rol
    const res1 = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .send({ name: 'Evaluador Externo' });

    expect(res1.status).toBe(201);

    // 2) Intentar duplicar con distinta capitalización
    const resDuplicated = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .send({ name: 'evaluador externo' });

    expect(resDuplicated.status).toBe(409);
    expect(resDuplicated.body.error.code).toBe('CONFLICT');

    // 3) Intentar crear rol con nombre de rol predefinido
    const resPredefined = await request(app)
      .post('/roles')
      .set('Authorization', adminActor.authHeader)
      .send({ name: 'Administrador' });

    expect(resPredefined.status).toBe(409);
    expect(resPredefined.body.error.code).toBe('CONFLICT');
  });

  it(
    'only one of N concurrent POST /roles with the same name returns 201',
    { timeout: 20_000 },
    async () => {
      const adminActor = await createActor(['ADMINISTRATOR']);

      const roleName = 'Rol Concurrente Test';
      const N = 5;

      const promises = Array.from({ length: N }, () =>
        request(app)
          .post('/roles')
          .set('Authorization', adminActor.authHeader)
          .send({
            name: roleName,
            description: 'Intento simultáneo de creación',
            permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
          }),
      );

      const responses = await Promise.all(promises);

      const created = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(created).toHaveLength(1);
      expect(conflicts).toHaveLength(N - 1);

      for (const conflict of conflicts) {
        expect(conflict.body.error.code).toBe('CONFLICT');
      }

      // Exactamente 1 fila creada en PostgreSQL
      const matchingRoles = await prisma.role.findMany({
        where: { name: roleName },
      });
      expect(matchingRoles).toHaveLength(1);
      const createdRole = matchingRoles[0];
      expect(createdRole).toBeDefined();

      // Exactamente 1 evento de auditoría CREATE
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entity: 'Role',
          entityId: createdRole?.id,
          action: 'CREATE',
        },
      });
      expect(auditLogs).toHaveLength(1);
    },
  );
});
