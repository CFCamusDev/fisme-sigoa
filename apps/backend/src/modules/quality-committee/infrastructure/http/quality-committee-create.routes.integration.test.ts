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

describe('POST /quality-committees (PostgreSQL real, HU-025, T-025-25, RF-025, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-quality-committee-create',
  });

  const emailSender = new InMemoryEmailSender();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const currentYear = new Date().getUTCFullYear();
  const CURRENT_START = `${currentYear}-01-01`;
  const CURRENT_END = `${currentYear}-12-31`;

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

  const postCommittee = (token: string) =>
    request(app).post('/quality-committees').set('Authorization', `Bearer ${token}`);

  it('registers the committee and returns it', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await postCommittee(president.token).send({
      periodStart: CURRENT_START,
      periodEnd: CURRENT_END,
      members: [
        { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' },
        { fullName: 'Carlos Méndez', degree: 'Mg.', position: 'MEMBER' },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const parsed = qualityCommitteeSchema.parse(response.body);
    expect(parsed.periodStart).toBe(CURRENT_START);
    expect(parsed.periodEnd).toBe(CURRENT_END);
    expect(parsed.isCurrent).toBe(true);
    expect(parsed.members).toHaveLength(2);

    const auditCount = await prisma.auditLog.count({
      where: { entity: 'QualityCommittee', entityId: parsed.id, action: 'CREATE' },
    });
    expect(auditCount).toBe(1);
  }, 5_000);

  it('links a member by email to an active user', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    await prisma.user.create({
      data: {
        id: 'usr-linked',
        names: 'Elena',
        firstSurname: 'Paredes',
        secondSurname: 'Luna',
        email: 'elena.paredes@example.test',
        status: 'ACTIVE',
      },
    });

    const response = await postCommittee(president.token).send({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [
        {
          fullName: 'Elena Paredes',
          degree: 'Dr.',
          position: 'PRESIDENT',
          userEmail: 'ELENA.PAREDES@example.test',
        },
      ],
    });

    expect(response.status).toBe(201);
    const parsed = qualityCommitteeSchema.parse(response.body);
    expect(parsed.members[0]?.userId).toBe('usr-linked');
    expect(parsed.members[0]?.linkedUserName).toBe('Elena Paredes Luna');
    expect(JSON.stringify(response.body)).not.toContain('elena.paredes@example.test');
  }, 5_000);

  it('accepts members without an account', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await postCommittee(president.token).send({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [
        {
          fullName: 'Ana Torres',
          degree: 'Dr.',
          position: 'PRESIDENT',
          userId: null,
          userEmail: '',
        },
        { fullName: 'Luis Rojas', degree: 'Mg.', position: 'MEMBER' },
      ],
    });

    expect(response.status).toBe(201);
    const parsed = qualityCommitteeSchema.parse(response.body);
    expect(parsed.members.every((m) => m.userId === null && m.linkedUserName === null)).toBe(true);
  }, 5_000);

  it('returns 400 for hostile bodies', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const hostileBodies: unknown[] = [
      {
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        extra: true,
        members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
      },
      { periodStart: '2027-01-01', periodEnd: '2027-12-31', members: [] },
      {
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [
          { fullName: 'P', degree: 'Dr.', position: 'PRESIDENT' },
          ...Array.from({ length: 30 }, (_, i) => ({
            fullName: `M${i}`,
            degree: 'Ing.',
            position: 'MEMBER',
          })),
        ],
      },
      {
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [
          { fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' },
          { fullName: 'Luis', degree: 'Dr.', position: 'PRESIDENT' },
        ],
      },
      {
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [
          {
            fullName: 'Ana',
            degree: 'Dr.',
            position: 'PRESIDENT',
            userId: 'u1',
            userEmail: 'ana@example.test',
          },
        ],
      },
      {
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [{ fullName: 'A'.repeat(161), degree: 'Dr.', position: 'PRESIDENT' }],
      },
      {
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [{ fullName: 'Ana', degree: 'D'.repeat(61), position: 'PRESIDENT' }],
      },
      {
        periodStart: '2027-02-30',
        periodEnd: '2027-12-31',
        members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
      },
      {
        periodStart: '1999-01-01',
        periodEnd: '2027-12-31',
        members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
      },
      {
        periodStart: '2027-12-31',
        periodEnd: '2027-01-01',
        members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
      },
    ];

    for (const body of hostileBodies) {
      const response = await postCommittee(president.token).send(body as Record<string, unknown>);
      expect(response.status).toBe(400);
    }
  }, 5_000);

  it('returns 401 without token', async () => {
    const response = await request(app)
      .post('/quality-committees')
      .send({
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
      });

    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without comite.editar', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await postCommittee(member.token).send({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
    });

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 409 for an overlapping period', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const first = await postCommittee(president.token).send({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [{ fullName: 'Ana', degree: 'Dr.', position: 'PRESIDENT' }],
    });
    expect(first.status).toBe(201);

    const overlap = await postCommittee(president.token).send({
      periodStart: '2027-06-01',
      periodEnd: '2028-05-31',
      members: [{ fullName: 'Luis', degree: 'Dr.', position: 'PRESIDENT' }],
    });
    expect(overlap.status).toBe(409);
  }, 5_000);

  it('returns 409 for an unknown or inactive user', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    await prisma.user.create({
      data: {
        id: 'usr-inactive',
        names: 'Rosa',
        firstSurname: 'Vega',
        email: 'rosa.vega@example.test',
        status: 'INACTIVE',
      },
    });

    const unknown = await postCommittee(president.token).send({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [
        {
          fullName: 'Alguien',
          degree: 'Dr.',
          position: 'PRESIDENT',
          userEmail: 'desconocido@example.test',
        },
      ],
    });
    expect(unknown.status).toBe(409);

    const inactive = await postCommittee(president.token).send({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [
        {
          fullName: 'Rosa Vega',
          degree: 'Dr.',
          position: 'PRESIDENT',
          userEmail: 'rosa.vega@example.test',
        },
      ],
    });
    expect(inactive.status).toBe(409);
    expect(unknown.body.message).toBe(inactive.body.message);
  }, 5_000);

  it('registers exactly one committee under concurrent overlapping POST requests', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        postCommittee(president.token).send({
          periodStart: '2027-01-01',
          periodEnd: '2027-12-31',
          members: [
            { fullName: `Presidente ${index}`, degree: 'Dr.', position: 'PRESIDENT' },
            { fullName: `Miembro ${index}`, degree: 'Mg.', position: 'MEMBER' },
          ],
        }),
      ),
    );

    const statuses = responses.map((res) => res.status).sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409, 409, 409, 409]);

    const committeeCount = await prisma.qualityCommittee.count();
    expect(committeeCount).toBe(1);

    const auditCount = await prisma.auditLog.count({
      where: { entity: 'QualityCommittee', action: 'CREATE' },
    });
    expect(auditCount).toBe(1);
  }, 5_000);
});
