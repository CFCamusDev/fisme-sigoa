import { qualityCommitteeSchema } from '@sigoa/shared';
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

describe('PUT /quality-committees/:id/members (PostgreSQL real, HU-025, T-025-26, RF-025, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-quality-committee-members',
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

  const putMembers = (token: string, id: string) =>
    request(app).put(`/quality-committees/${id}/members`).set('Authorization', `Bearer ${token}`);

  async function seedCommittee(
    id = 'com-2027',
    periodStart = '2027-01-01',
    periodEnd = '2027-12-31',
    linkedUserId: string | null = null,
  ) {
    await prisma.qualityCommittee.create({
      data: {
        id,
        programId: 'prog-1',
        periodStart: new Date(`${periodStart}T00:00:00.000Z`),
        periodEnd: new Date(`${periodEnd}T00:00:00.000Z`),
        createdBy: 'seed',
        members: {
          create: [
            {
              fullName: 'Ana Torres',
              degree: 'Dr.',
              position: 'PRESIDENT',
              userId: linkedUserId,
              createdBy: 'seed',
            },
            {
              fullName: 'Carlos Méndez',
              degree: 'Mg.',
              position: 'MEMBER',
              userId: null,
              createdBy: 'seed',
            },
          ],
        },
      },
    });
  }

  it('replaces the members and returns them', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    await seedCommittee();

    const response = await putMembers(president.token, 'com-2027').send({
      members: [
        { fullName: 'Luis Rojas', degree: 'Dr.', position: 'PRESIDENT' },
        { fullName: 'Elena Paredes', degree: 'Ing.', position: 'MEMBER' },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const parsed = qualityCommitteeSchema.parse(response.body);
    expect(parsed.members.map((m) => m.fullName)).toEqual(['Luis Rojas', 'Elena Paredes']);

    const auditCount = await prisma.auditLog.count({
      where: { entity: 'QualityCommittee', entityId: 'com-2027', action: 'UPDATE' },
    });
    expect(auditCount).toBe(1);
  }, 5_000);

  it('keeps an existing link with userId without exposing email', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    await prisma.user.create({
      data: {
        id: 'usr-linked',
        names: 'Ana',
        firstSurname: 'Torres',
        secondSurname: 'Quispe',
        email: 'ana.torres@example.test',
        status: 'ACTIVE',
      },
    });
    await seedCommittee('com-2027', '2027-01-01', '2027-12-31', 'usr-linked');

    const response = await putMembers(president.token, 'com-2027').send({
      members: [
        { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-linked' },
      ],
    });

    expect(response.status).toBe(200);
    const parsed = qualityCommitteeSchema.parse(response.body);
    expect(parsed.members).toHaveLength(1);
    expect(parsed.members[0]?.userId).toBe('usr-linked');
    expect(parsed.members[0]?.linkedUserName).toBe('Ana Torres Quispe');
    expect(JSON.stringify(response.body)).not.toContain('ana.torres@example.test');
  }, 5_000);

  it('returns 400 for hostile bodies and oversized id', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    await seedCommittee();

    const oversizedId = await putMembers(president.token, 'x'.repeat(65)).send({
      members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
    });
    expect(oversizedId.status).toBe(400);

    const hostileBodies: unknown[] = [
      {},
      { members: [] },
      {
        extra: true,
        members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
      },
      {
        members: [
          { fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' },
          { fullName: 'Luis', degree: 'Dr.', position: 'PRESIDENT' },
        ],
      },
    ];

    for (const body of hostileBodies) {
      const response = await putMembers(president.token, 'com-2027').send(
        body as Record<string, unknown>,
      );
      expect(response.status).toBe(400);
    }
  }, 5_000);

  it('returns 401 without token', async () => {
    await seedCommittee();

    const response = await request(app)
      .put('/quality-committees/com-2027/members')
      .send({
        members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
      });

    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without comite.editar', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    await seedCommittee();

    const response = await putMembers(member.token, 'com-2027').send({
      members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
    });

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 404 for an unknown committee', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await putMembers(president.token, 'com-unknown').send({
      members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
    });

    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 409 for a committee whose period ended', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    await seedCommittee('com-2026', '2026-01-01', '2026-12-31');

    const response = await putMembers(president.token, 'com-2026').send({
      members: [{ fullName: 'Luis Rojas', degree: 'Dr.', position: 'PRESIDENT' }],
    });

    expect(response.status).toBe(409);
  }, 5_000);

  it('does not audit when the set is unchanged', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    await seedCommittee();

    const response = await putMembers(president.token, 'com-2027').send({
      members: [
        { fullName: 'Carlos Méndez', degree: 'Mg.', position: 'MEMBER' },
        { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' },
      ],
    });

    expect(response.status).toBe(200);
    const auditCount = await prisma.auditLog.count({
      where: { entity: 'QualityCommittee', entityId: 'com-2027', action: 'UPDATE' },
    });
    expect(auditCount).toBe(0);
  }, 5_000);

  it('handles concurrent identical PUT requests idempotently', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    await seedCommittee();

    const payload = {
      members: [
        { fullName: 'Luis Rojas', degree: 'Dr.', position: 'PRESIDENT' as const },
        { fullName: 'Elena Paredes', degree: 'Ing.', position: 'MEMBER' as const },
      ],
    };

    const responses = await Promise.all(
      Array.from({ length: 4 }, () => putMembers(president.token, 'com-2027').send(payload)),
    );

    expect(responses.every((res) => res.status === 200)).toBe(true);

    const auditCount = await prisma.auditLog.count({
      where: { entity: 'QualityCommittee', entityId: 'com-2027', action: 'UPDATE' },
    });
    expect(auditCount).toBe(1);
  }, 5_000);
});
