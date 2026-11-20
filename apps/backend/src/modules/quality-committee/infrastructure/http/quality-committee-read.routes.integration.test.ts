import {
  currentQualityCommitteeResponseSchema,
  qualityCommitteeListResponseSchema,
} from '@sigoa/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization-fast.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';

describe('GET /quality-committees/current & GET /quality-committees (PostgreSQL real, HU-025, T-025-27)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-quality-committee-read',
  });

  const emailSender = new InMemoryEmailSender();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const FIXED_NOW = new Date('2027-06-15T15:00:00.000Z');

  const app = createApp({
    env,
    setupRoutes: (instance) => {
      setupAppRoutes(instance, {
        unitOfWork: uow,
        auditLogger: auditServices.auditLogger,
        dbProvider: uow,
        env,
        emailSender,
        clock: () => FIXED_NOW,
      });
    },
  });

  beforeEach(async () => {
    emailSender.clear();
    await seedAuthorizationFast(prisma);
    await prisma.program.create({
      data: {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
  });

  const createActor = (roles: string[]) =>
    createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });

  it('GET current returns the committee in force', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    await prisma.qualityCommittee.create({
      data: {
        id: 'com-2027',
        programId: 'prog-1',
        periodStart: new Date('2027-01-01T00:00:00.000Z'),
        periodEnd: new Date('2027-12-31T00:00:00.000Z'),
        createdBy: 'seed',
        members: {
          create: [
            {
              fullName: 'Ana Torres',
              degree: 'Dr.',
              position: 'PRESIDENT',
              userId: null,
              createdBy: 'seed',
            },
          ],
        },
      },
    });

    const response = await request(app)
      .get('/quality-committees/current')
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const parsed = currentQualityCommitteeResponseSchema.parse(response.body);
    expect(parsed.committee?.id).toBe('com-2027');
    expect(parsed.committee?.isCurrent).toBe(true);
    expect(parsed.actorMembership).toBeNull();
  }, 5_000);

  it('GET current returns the actor membership', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    await prisma.qualityCommittee.create({
      data: {
        id: 'com-2027',
        programId: 'prog-1',
        periodStart: new Date('2027-01-01T00:00:00.000Z'),
        periodEnd: new Date('2027-12-31T00:00:00.000Z'),
        createdBy: 'seed',
        members: {
          create: [
            {
              fullName: 'Ana Torres',
              degree: 'Dr.',
              position: 'PRESIDENT',
              userId: null,
              createdBy: 'seed',
            },
            {
              fullName: 'Miembro Vinculado',
              degree: 'Mg.',
              position: 'MEMBER',
              userId: member.user.id,
              createdBy: 'seed',
            },
          ],
        },
      },
    });

    const response = await request(app)
      .get('/quality-committees/current')
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    const parsed = currentQualityCommitteeResponseSchema.parse(response.body);
    expect(parsed.actorMembership?.position).toBe('MEMBER');
  }, 5_000);

  it('GET current returns alerts for a president role holder who is not the current president', async () => {
    const previousPresident = await createActor(['COMMITTEE_PRESIDENT']);
    const admin = await createActor(['ADMINISTRATOR']);

    await prisma.user.create({
      data: {
        id: 'usr-new-pres',
        names: 'Elena',
        firstSurname: 'Paredes',
        email: 'elena.paredes@example.test',
        status: 'ACTIVE',
      },
    });

    await prisma.qualityCommittee.create({
      data: {
        id: 'com-2027',
        programId: 'prog-1',
        periodStart: new Date('2027-01-01T00:00:00.000Z'),
        periodEnd: new Date('2027-12-31T00:00:00.000Z'),
        createdBy: 'seed',
        members: {
          create: [
            {
              fullName: 'Elena Paredes',
              degree: 'Dr.',
              position: 'PRESIDENT',
              userId: 'usr-new-pres',
              createdBy: 'seed',
            },
          ],
        },
      },
    });

    const response = await request(app)
      .get('/quality-committees/current')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    const parsed = currentQualityCommitteeResponseSchema.parse(response.body);
    expect(parsed.alerts).toHaveLength(1);
    expect(parsed.alerts[0]?.userId).toBe(previousPresident.user.id);
    expect(JSON.stringify(response.body)).not.toContain('@');
  }, 5_000);

  it('GET current returns null without a committee', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .get('/quality-committees/current')
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    const parsed = currentQualityCommitteeResponseSchema.parse(response.body);
    expect(parsed.committee).toBeNull();
    expect(parsed.actorMembership).toBeNull();
  }, 5_000);

  it('GET current returns 400 for unknown query', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .get('/quality-committees/current?unexpected=1')
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(400);
  }, 5_000);

  it('GET current returns 401 without token and 403 without comite.ver', async () => {
    const unauth = await request(app).get('/quality-committees/current');
    expect(unauth.status).toBe(401);

    const teacher = await createActor(['TEACHER']);
    const forbidden = await request(app)
      .get('/quality-committees/current')
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(forbidden.status).toBe(403);
  }, 5_000);

  it('GET list returns the history from the newest period', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    await prisma.qualityCommittee.createMany({
      data: [
        {
          id: 'com-2026',
          programId: 'prog-1',
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          periodEnd: new Date('2026-12-31T00:00:00.000Z'),
          createdBy: 'seed',
        },
        {
          id: 'com-2028',
          programId: 'prog-1',
          periodStart: new Date('2028-01-01T00:00:00.000Z'),
          periodEnd: new Date('2028-12-31T00:00:00.000Z'),
          createdBy: 'seed',
        },
        {
          id: 'com-2027',
          programId: 'prog-1',
          periodStart: new Date('2027-01-01T00:00:00.000Z'),
          periodEnd: new Date('2027-12-31T00:00:00.000Z'),
          createdBy: 'seed',
        },
      ],
    });

    const response = await request(app)
      .get('/quality-committees?page=1&pageSize=2')
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    const parsed = qualityCommitteeListResponseSchema.parse(response.body);
    expect(parsed.total).toBe(3);
    expect(parsed.items.map((item) => item.id)).toEqual(['com-2028', 'com-2027']);
    expect(parsed.items.map((item) => item.isCurrent)).toEqual([false, true]);

    const emptyPage = await request(app)
      .get('/quality-committees?page=5&pageSize=2')
      .set('Authorization', `Bearer ${member.token}`);
    expect(emptyPage.status).toBe(200);
    expect(qualityCommitteeListResponseSchema.parse(emptyPage.body).items).toEqual([]);
  }, 5_000);

  it('GET list returns 400 for page 0, pageSize 51 or unknown query', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const badQueries = ['?page=0', '?pageSize=51', '?unknown=1'];
    for (const query of badQueries) {
      const response = await request(app)
        .get(`/quality-committees${query}`)
        .set('Authorization', `Bearer ${member.token}`);
      expect(response.status).toBe(400);
    }
  }, 5_000);

  it('GET list returns 401 without token and 403 without comite.ver', async () => {
    const unauth = await request(app).get('/quality-committees');
    expect(unauth.status).toBe(401);

    const teacher = await createActor(['TEACHER']);
    const forbidden = await request(app)
      .get('/quality-committees')
      .set('Authorization', `Bearer ${teacher.token}`);
    expect(forbidden.status).toBe(403);
  }, 5_000);
});
