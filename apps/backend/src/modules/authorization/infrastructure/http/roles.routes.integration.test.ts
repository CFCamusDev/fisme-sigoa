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
import { seedAuthorization } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('Roles HTTP Routes Integration (PostgreSQL real, HU-003, T-003-15, A2, A5)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-abc-123456',
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

  it('lists the five predefined roles for an administrator (A2, A5)', async () => {
    const admin = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: ['ADMINISTRATOR'],
    });

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

  it('returns 401 without a token (A5)', async () => {
    const response = await request(app).get('/roles');

    expect(response.status).toBe(401);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  }, 15_000);

  it('returns 403 without rol.ver permission (A5)', async () => {
    const teacher = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: ['TEACHER'],
    });

    const response = await request(app).get('/roles').set('Authorization', teacher.authHeader);

    expect(response.status).toBe(403);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('FORBIDDEN');
  }, 15_000);

  it('answers with Cache-Control: no-store (A5)', async () => {
    const admin = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: ['ADMINISTRATOR'],
    });

    const response = await request(app).get('/roles').set('Authorization', admin.authHeader);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  }, 15_000);
});
