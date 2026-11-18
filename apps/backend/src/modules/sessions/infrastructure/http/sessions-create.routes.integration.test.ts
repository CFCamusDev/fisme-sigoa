import { sessionDtoSchema } from '@sigoa/shared';
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

describe('POST /sessions (PostgreSQL real, HU-032, T-032-22, RF-032, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-sessions-create-routes',
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

  const postSession = (token: string) =>
    request(app).post('/sessions').set('Authorization', `Bearer ${token}`);

  async function seedDomainData() {
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
        {
          id: 'exec-closed',
          programId: 'prog-1',
          type: 'P612',
          name: 'Medición Cerrada 2025',
          year: 2025,
          catalogVersionId: 'cv-1',
          status: 'CLOSED',
          createdBy: 'seed',
        },
      ],
    });
    await prisma.stakeholderList.createMany({
      data: [
        {
          id: 'list-emp',
          programId: 'prog-1',
          type: 'EMPLOYER',
          year: 2026,
          createdBy: 'seed',
        },
        {
          id: 'list-grad',
          programId: 'prog-1',
          type: 'GRADUATE',
          year: 2026,
          createdBy: 'seed',
        },
      ],
    });
  }

  it('registers one session linked to three executions', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      stakeholderListId: 'list-emp',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'VIRTUAL',
      meetingUrl: 'https://meet.example.com/emp-2026',
      recordingUrl: 'https://drive.example.com/emp-2026',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
    });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = sessionDtoSchema.parse(response.body);
    expect(dto.executionIds).toEqual(['exec-1', 'exec-2', 'exec-3']);

    const links = await prisma.sessionExecution.findMany({
      where: { sessionId: dto.id },
      orderBy: { processExecutionId: 'asc' },
    });
    expect(links.map((l) => l.processExecutionId)).toEqual(['exec-1', 'exec-2', 'exec-3']);

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'Session', entityId: dto.id, action: 'CREATE' },
    });
    expect(audits).toHaveLength(1);
  }, 5_000);

  it('registers with only the required fields', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '14:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
    });

    expect(response.status).toBe(201);
    const dto = sessionDtoSchema.parse(response.body);
    expect(dto.stakeholderListId).toBeNull();
    expect(dto.meetingUrl).toBeNull();
    expect(dto.recordingUrl).toBeNull();
  }, 5_000);

  it('returns 400 without executions', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: [],
    });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for a virtual session without links', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'VIRTUAL',
      executionIds: ['exec-1'],
    });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for an unknown field', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
      unexpected: true,
    });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for a link that is not http or https', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'HYBRID',
      meetingUrl: 'javascript:alert(1)',
      executionIds: ['exec-1'],
    });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for an invalid date or time', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const badDate = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-02-30',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
    });
    expect(badDate.status).toBe(400);

    const badTime = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '24:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
    });
    expect(badTime.status).toBe(400);
  }, 5_000);

  it('returns 400 for more than 20 or repeated executions', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const tooMany = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: Array.from({ length: 21 }, (_, idx) => `exec-${idx + 1}`),
    });
    expect(tooMany.status).toBe(400);

    const repeated = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1', 'exec-1'],
    });
    expect(repeated.status).toBe(400);
  }, 5_000);

  it('returns 404 for an unknown execution', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-missing'],
    });
    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 409 for an execution that is closed', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-closed'],
    });
    expect(response.status).toBe(409);
  }, 5_000);

  it('returns 409 for a stakeholder list of another type', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await postSession(member.token).send({
      stakeholderType: 'EMPLOYER',
      stakeholderListId: 'list-grad',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
    });
    expect(response.status).toBe(409);
  }, 5_000);

  it('returns 409 for a duplicate type, date and time and leaves no audit record', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const payload = {
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
    };

    const first = await postSession(member.token).send(payload);
    expect(first.status).toBe(201);

    const second = await postSession(member.token).send(payload);
    expect(second.status).toBe(409);

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'Session', action: 'CREATE' },
    });
    expect(audits).toHaveLength(1);
  }, 5_000);

  it('lets exactly one of two concurrent identical requests win', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const payload = {
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-21',
      startTime: '16:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
    };

    const [r1, r2] = await Promise.all([
      postSession(member.token).send(payload),
      postSession(member.token).send(payload),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const sessions = await prisma.session.findMany();
    const links = await prisma.sessionExecution.findMany();
    const audits = await prisma.auditLog.findMany({
      where: { entity: 'Session', action: 'CREATE' },
    });
    expect(sessions).toHaveLength(1);
    expect(links).toHaveLength(3);
    expect(audits).toHaveLength(1);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app).post('/sessions').send({});
    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without sesion.editar', async () => {
    const director = await createActor(['PROGRAM_DIRECTOR']);
    const response = await postSession(director.token).send({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
    });
    expect(response.status).toBe(403);
  }, 5_000);
});
