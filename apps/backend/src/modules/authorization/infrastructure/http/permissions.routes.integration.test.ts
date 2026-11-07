import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { listPermissionsResponseSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorization } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { CATALOG_PERMISSIONS } from '../../domain/index.js';

describe('Permissions HTTP Routes Integration (PostgreSQL real, HU-006, T-006-33, RS-002, RS-010, LS 3.3, D3, D6)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-permissions-integration',
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

  it('lists the 72 catalog permissions ordered by module and code', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app).get('/permissions').set('Authorization', admin.authHeader);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const parsed = listPermissionsResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      const items = parsed.data.items;
      expect(items).toHaveLength(72);
      expect(items).toHaveLength(CATALOG_PERMISSIONS.length);

      // Comprobar orden: por módulo primero y luego por código
      for (let i = 0; i < items.length - 1; i++) {
        const curr = items[i];
        const next = items[i + 1];
        expect(curr).toBeDefined();
        expect(next).toBeDefined();
        if (!curr || !next) {
          continue;
        }

        if (curr.module !== next.module) {
          expect(curr.module.localeCompare(next.module)).toBeLessThanOrEqual(0);
        } else {
          expect(curr.code.localeCompare(next.code)).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  it('matches the catalog defined in the domain', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app).get('/permissions').set('Authorization', admin.authHeader);

    expect(response.status).toBe(200);
    const items = response.body.items as Array<{
      code: string;
      description: string;
      module: string;
    }>;

    const catalogMap = new Map(CATALOG_PERMISSIONS.map((p) => [p.code, p]));
    for (const item of items) {
      const catalogPerm = catalogMap.get(item.code);
      expect(catalogPerm).toBeDefined();
      expect(item.description).toBe(catalogPerm?.description);
      expect(item.module).toBe(catalogPerm?.module);
    }
  });

  it('returns 400 for any query parameter (D6)', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .get('/permissions?foo=bar')
      .set('Authorization', admin.authHeader);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without token', async () => {
    const response = await request(app).get('/permissions');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 without rol.ver permission', async () => {
    const teacher = await createActor(['TEACHER']);

    const response = await request(app)
      .get('/permissions')
      .set('Authorization', teacher.authHeader);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('sends no-store header', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app).get('/permissions').set('Authorization', admin.authHeader);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
