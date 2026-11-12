import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { listRolesResponseSchema } from '@sigoa/shared';
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

describe('Roles HTTP Routes Integration (PostgreSQL real, HU-003, T-003-15, HU-006, T-006-32, CA1, D6)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-get-roles-integration',
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

  it('lists the five predefined roles with their default matrix for an administrator (CA1, A2, A5)', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app).get('/roles').set('Authorization', admin.authHeader);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const parseResult = listRolesResponseSchema.safeParse(response.body);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const items = parseResult.data.items;
      expect(items.length).toBeGreaterThanOrEqual(5);

      const predefinedCodes = items.filter((r) => r.isPredefined).map((r) => r.code);
      expect(predefinedCodes).toContain('ADMINISTRATOR');
      expect(predefinedCodes).toContain('COMMITTEE_PRESIDENT');
      expect(predefinedCodes).toContain('COMMITTEE_MEMBER');
      expect(predefinedCodes).toContain('PROGRAM_DIRECTOR');
      expect(predefinedCodes).toContain('TEACHER');

      // Verificación de CA1: ADMINISTRATOR tiene rol.editar GLOBAL
      const adminRole = items.find((r) => r.code === 'ADMINISTRATOR');
      expect(adminRole).toBeDefined();
      const adminGrants = adminRole?.permissions ?? [];
      const editGrant = adminGrants.find((g) => g.permissionCode === 'rol.editar');
      expect(editGrant).toBeDefined();
      expect(editGrant?.scope).toBe('GLOBAL');

      // Verificación de CA1: los permisos de edición de TEACHER son estrictamente con alcance OWN (LS 3.3)
      const teacherRole = items.find((r) => r.code === 'TEACHER');
      expect(teacherRole).toBeDefined();
      const teacherGrants = teacherRole?.permissions ?? [];
      const teacherEditGrants = teacherGrants.filter((g) => !g.permissionCode.endsWith('.ver'));
      expect(teacherEditGrants.length).toBeGreaterThan(0);
      for (const grant of teacherEditGrants) {
        expect(grant.scope).toBe('OWN');
      }

      for (const item of items) {
        expect(item.status).toBe('ACTIVE');
        expect(typeof item.userCount).toBe('number');
        expect(item.userCount).toBeGreaterThanOrEqual(0);
        expect(item.permissions).toBeInstanceOf(Array);
        expect(item.updatedAt).toBeDefined();
      }

      // Comprobar orden: predefinidos primero, luego por nombre
      for (let i = 0; i < items.length - 1; i++) {
        const curr = items[i];
        const next = items[i + 1];
        expect(curr).toBeDefined();
        expect(next).toBeDefined();
        if (!curr || !next) {
          continue;
        }

        if (curr.isPredefined !== next.isPredefined) {
          expect(curr.isPredefined).toBe(true);
          expect(next.isPredefined).toBe(false);
        } else {
          expect(curr.name.localeCompare(next.name)).toBeLessThanOrEqual(0);
        }
      }
    }
  }, 15_000);

  it('counts users per role correctly', async () => {
    const admin = await createActor(['ADMINISTRATOR']);
    // Crear dos docentes activos
    await createActor(['TEACHER']);
    await createActor(['TEACHER']);

    const response = await request(app).get('/roles').set('Authorization', admin.authHeader);

    expect(response.status).toBe(200);
    const teacherRole = response.body.items.find((r: { code: string }) => r.code === 'TEACHER');
    expect(teacherRole).toBeDefined();
    expect(teacherRole.userCount).toBe(2);

    const adminRole = response.body.items.find((r: { code: string }) => r.code === 'ADMINISTRATOR');
    expect(adminRole).toBeDefined();
    expect(adminRole.userCount).toBe(1);
  }, 15_000);

  it('shows an inactive role with its status and deactivatedAt', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const deactivatedDate = new Date('2026-11-01T10:00:00.000Z');
    await prisma.role.create({
      data: {
        code: 'ROL_INACTIVO_TEST',
        name: 'Rol Inactivo de Prueba',
        description: 'Rol para probar visualización de estado inactivo',
        status: 'INACTIVE',
        isPredefined: false,
        deactivatedAt: deactivatedDate,
      },
    });

    const response = await request(app).get('/roles').set('Authorization', admin.authHeader);

    expect(response.status).toBe(200);
    const inactiveRole = response.body.items.find(
      (r: { code: string }) => r.code === 'ROL_INACTIVO_TEST',
    );
    expect(inactiveRole).toBeDefined();
    expect(inactiveRole.status).toBe('INACTIVE');
    expect(inactiveRole.deactivatedAt).toBe(deactivatedDate.toISOString());
    expect(inactiveRole.isPredefined).toBe(false);
  }, 15_000);

  it('returns a custom role without description or permissions (incomplete but valid)', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const customRole = await createRoleWithGrants(prisma, {
      name: 'Rol Minimalista',
      description: null,
      grants: [],
    });

    const response = await request(app).get('/roles').set('Authorization', admin.authHeader);

    expect(response.status).toBe(200);
    const found = response.body.items.find((r: { id: string }) => r.id === customRole.id);
    expect(found).toBeDefined();
    expect(found.name).toBe('Rol Minimalista');
    expect(found.description).toBeNull();
    expect(found.permissions).toEqual([]);
    expect(found.isPredefined).toBe(false);
    expect(found.status).toBe('ACTIVE');
  }, 15_000);

  it('returns 400 for any query parameter (T-006-17, D6)', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .get('/roles?unexpected=parameter&another=123')
      .set('Authorization', admin.authHeader);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  }, 15_000);

  it('returns 401 without a token (A5)', async () => {
    const response = await request(app).get('/roles');

    expect(response.status).toBe(401);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  }, 15_000);

  it('returns 403 without rol.ver permission (A5)', async () => {
    const teacher = await createActor(['TEACHER']);

    const response = await request(app).get('/roles').set('Authorization', teacher.authHeader);

    expect(response.status).toBe(403);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('FORBIDDEN');
  }, 15_000);

  it('answers with Cache-Control: no-store (A5)', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app).get('/roles').set('Authorization', admin.authHeader);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  }, 15_000);
});
