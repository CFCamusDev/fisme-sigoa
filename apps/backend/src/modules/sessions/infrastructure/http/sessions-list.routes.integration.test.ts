import { listSessionsResponseSchema } from '@sigoa/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';

describe('GET /process-executions/:id/sessions (PostgreSQL real, HU-032, T-032-24, RF-032, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-sessions-list-routes',
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

  const createActor = (roles: string[]) =>
    createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });

  const getSessions = (token: string, executionId: string) =>
    request(app)
      .get(`/process-executions/${executionId}/sessions`)
      .set('Authorization', `Bearer ${token}`);

  async function seedExecutions() {
    await prisma.program.create({
      data: {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
    await prisma.catalogVersion.create({
      data: {
        id: 'cv-1',
        programId: 'prog-1',
        number: 1,
        status: 'APPROVED',
      },
    });
    await prisma.processExecution.createMany({
      data: [
        {
          id: 'exec-1',
          programId: 'prog-1',
          type: 'P613',
          name: 'Revisión OE 2026',
          year: 2026,
          catalogVersionId: 'cv-1',
          status: 'PLANNED',
          createdBy: 'seed',
        },
        {
          id: 'exec-2',
          programId: 'prog-1',
          type: 'P612',
          name: 'Medición OE 2026',
          year: 2026,
          catalogVersionId: 'cv-1',
          status: 'IN_PROGRESS',
          createdBy: 'seed',
        },
        {
          id: 'exec-3',
          programId: 'prog-1',
          type: 'P623',
          name: 'Medición indirecta AG 2026',
          year: 2026,
          catalogVersionId: 'cv-1',
          status: 'PLANNED',
          createdBy: 'seed',
        },
      ],
    });
  }

  async function createSessionViaApi(
    token: string,
    payload: {
      sessionDate: string;
      startTime: string;
      executionIds: string[];
    },
  ) {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        stakeholderType: 'EMPLOYER',
        modality: 'IN_PERSON',
        ...payload,
      });
    expect(res.status).toBe(201);
    return res.body as { id: string };
  }

  it('returns the session under each of its three executions', async () => {
    await seedExecutions();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const created = await createSessionViaApi(member.token, {
      sessionDate: '2026-11-20',
      startTime: '10:00',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
    });

    for (const executionId of ['exec-1', 'exec-2', 'exec-3']) {
      const response = await getSessions(member.token, executionId);
      expect(response.status).toBe(200);
      const parsed = listSessionsResponseSchema.parse(response.body);
      expect(parsed.total).toBe(1);
      expect(parsed.items[0]?.id).toBe(created.id);
      expect(parsed.items[0]?.executionIds).toEqual(['exec-1', 'exec-2', 'exec-3']);
    }
  }, 5_000);

  it('lists newest first with the linked execution ids', async () => {
    await seedExecutions();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const older = await createSessionViaApi(member.token, {
      sessionDate: '2026-11-18',
      startTime: '09:00',
      executionIds: ['exec-1'],
    });
    const newer = await createSessionViaApi(member.token, {
      sessionDate: '2026-11-20',
      startTime: '15:00',
      executionIds: ['exec-1', 'exec-2'],
    });

    const response = await getSessions(member.token, 'exec-1');
    expect(response.status).toBe(200);
    const parsed = listSessionsResponseSchema.parse(response.body);
    expect(parsed.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(parsed.items[0]?.executionIds).toEqual(['exec-1', 'exec-2']);
  }, 5_000);

  it('lists sessions with attendeeCount', async () => {
    await seedExecutions();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const list = await prisma.stakeholderList.create({
      data: {
        id: 'list-http-count',
        programId: 'prog-1',
        type: 'EMPLOYER',
        year: 2026,
        createdBy: member.user.id,
      },
    });
    const listMember = await prisma.stakeholderListMember.create({
      data: {
        id: 'lm-http-1',
        listId: list.id,
        stakeholderId: 'st-http-1',
        fullName: 'Ana Empleadora',
        createdBy: member.user.id,
      },
    });
    const s1 = await createSessionViaApi(member.token, {
      sessionDate: '2026-11-20',
      startTime: '10:00',
      executionIds: ['exec-1'],
    });
    await prisma.attendee.create({
      data: { sessionId: s1.id, listMemberId: listMember.id, createdBy: member.user.id },
    });

    const response = await getSessions(member.token, 'exec-1');
    expect(response.status).toBe(200);
    const parsed = listSessionsResponseSchema.parse(response.body);
    expect(parsed.items[0]?.attendeeCount).toBe(1);
  }, 5_000);

  it('paginates with page and pageSize', async () => {
    await seedExecutions();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const s1 = await createSessionViaApi(member.token, {
      sessionDate: '2026-11-18',
      startTime: '09:00',
      executionIds: ['exec-1'],
    });
    const s2 = await createSessionViaApi(member.token, {
      sessionDate: '2026-11-19',
      startTime: '09:00',
      executionIds: ['exec-1'],
    });
    const s3 = await createSessionViaApi(member.token, {
      sessionDate: '2026-11-20',
      startTime: '09:00',
      executionIds: ['exec-1'],
    });

    const page1 = await getSessions(member.token, 'exec-1').query({ page: 1, pageSize: 2 });
    expect(page1.status).toBe(200);
    const parsed1 = listSessionsResponseSchema.parse(page1.body);
    expect(parsed1.total).toBe(3);
    expect(parsed1.items.map((i) => i.id)).toEqual([s3.id, s2.id]);

    const page2 = await getSessions(member.token, 'exec-1').query({ page: 2, pageSize: 2 });
    expect(page2.status).toBe(200);
    const parsed2 = listSessionsResponseSchema.parse(page2.body);
    expect(parsed2.items.map((i) => i.id)).toEqual([s1.id]);
  }, 5_000);

  it('returns an empty page for an execution without sessions', async () => {
    await seedExecutions();
    const director = await createActor(['PROGRAM_DIRECTOR']);

    const response = await getSessions(director.token, 'exec-1');
    expect(response.status).toBe(200);
    const parsed = listSessionsResponseSchema.parse(response.body);
    expect(parsed).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
  }, 5_000);

  it('returns 400 for pageSize over 100', async () => {
    const director = await createActor(['PROGRAM_DIRECTOR']);
    const response = await getSessions(director.token, 'exec-1').query({ pageSize: 101 });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for page 0', async () => {
    const director = await createActor(['PROGRAM_DIRECTOR']);
    const response = await getSessions(director.token, 'exec-1').query({ page: 0 });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for an unknown query parameter', async () => {
    const director = await createActor(['PROGRAM_DIRECTOR']);
    const response = await getSessions(director.token, 'exec-1').query({ extra: '1' });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 404 for an unknown execution', async () => {
    const director = await createActor(['PROGRAM_DIRECTOR']);
    const response = await getSessions(director.token, 'exec-unknown');
    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app).get('/process-executions/exec-1/sessions');
    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without sesion.ver', async () => {
    const actorWithoutPerms = await createActor([]);
    const response = await getSessions(actorWithoutPerms.token, 'exec-1');
    expect(response.status).toBe(403);
  }, 5_000);
});
