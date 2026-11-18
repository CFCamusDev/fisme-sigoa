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

describe('PATCH /sessions/:id (PostgreSQL real, HU-032, T-032-23, RF-032, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-sessions-update-routes',
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

  const patchSession = (token: string, id: string) =>
    request(app).patch(`/sessions/${id}`).set('Authorization', `Bearer ${token}`);

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
  }

  async function createInitialSession(token: string, overrides?: Record<string, unknown>) {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'HYBRID',
        meetingUrl: 'https://meet.example.com/initial',
        executionIds: ['exec-1'],
        ...overrides,
      });
    expect(res.status).toBe(201);
    return sessionDtoSchema.parse(res.body);
  }

  it('edits the date and keeps the links', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const initial = await createInitialSession(member.token);

    const response = await patchSession(member.token, initial.id).send({
      sessionDate: '2026-11-25',
    });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = sessionDtoSchema.parse(response.body);
    expect(dto.sessionDate).toBe('2026-11-25');
    expect(dto.executionIds).toEqual(['exec-1']);
    expect(dto.meetingUrl).toBe('https://meet.example.com/initial');

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'Session', entityId: initial.id, action: 'UPDATE' },
    });
    expect(audits).toHaveLength(1);
  }, 5_000);

  it('replaces the executions', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const initial = await createInitialSession(member.token);

    const response = await patchSession(member.token, initial.id).send({
      executionIds: ['exec-2', 'exec-3'],
    });

    expect(response.status).toBe(200);
    const dto = sessionDtoSchema.parse(response.body);
    expect(dto.executionIds).toEqual(['exec-2', 'exec-3']);

    const links = await prisma.sessionExecution.findMany({
      where: { sessionId: initial.id },
      orderBy: { processExecutionId: 'asc' },
    });
    expect(links.map((l) => l.processExecutionId)).toEqual(['exec-2', 'exec-3']);
  }, 5_000);

  it('returns 200 without a new audit record when the same edit is repeated', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const initial = await createInitialSession(member.token);

    const response = await patchSession(member.token, initial.id).send({
      sessionDate: '2026-11-20',
      startTime: '10:00',
      executionIds: ['exec-1'],
    });

    expect(response.status).toBe(200);
    const audits = await prisma.auditLog.findMany({
      where: { entity: 'Session', entityId: initial.id, action: 'UPDATE' },
    });
    expect(audits).toHaveLength(0);
  }, 5_000);

  it('removes an optional link with null', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const initial = await createInitialSession(member.token, {
      modality: 'IN_PERSON',
      meetingUrl: 'https://meet.example.com/opt',
    });

    const response = await patchSession(member.token, initial.id).send({
      meetingUrl: null,
    });

    expect(response.status).toBe(200);
    const dto = sessionDtoSchema.parse(response.body);
    expect(dto.meetingUrl).toBeNull();
  }, 5_000);

  it('serializes two concurrent edits with different execution sets', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const initial = await createInitialSession(member.token);

    const [r1, r2] = await Promise.all([
      patchSession(member.token, initial.id).send({ executionIds: ['exec-1', 'exec-2'] }),
      patchSession(member.token, initial.id).send({ executionIds: ['exec-2', 'exec-3'] }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const links = await prisma.sessionExecution.findMany({
      where: { sessionId: initial.id },
      orderBy: { processExecutionId: 'asc' },
    });
    const finalIds = links.map((l) => l.processExecutionId);
    expect([
      ['exec-1', 'exec-2'],
      ['exec-2', 'exec-3'],
    ]).toContainEqual(finalIds);
  }, 5_000);

  it('returns 400 for an empty body', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await patchSession(member.token, 'sess-1').send({});
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for an unknown field', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await patchSession(member.token, 'sess-1').send({
      startTime: '11:00',
      extra: true,
    });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for an id over 64 characters', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await patchSession(member.token, 'a'.repeat(65)).send({
      startTime: '11:00',
    });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 when switching to virtual without links', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const initial = await createInitialSession(member.token, {
      modality: 'IN_PERSON',
      meetingUrl: null,
      recordingUrl: null,
    });

    const response = await patchSession(member.token, initial.id).send({
      modality: 'VIRTUAL',
    });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 404 for an unknown session', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await patchSession(member.token, 'sess-unknown').send({
      startTime: '11:00',
    });
    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 409 when a linked execution is closed', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    const initial = await createInitialSession(member.token);

    await prisma.processExecution.update({
      where: { id: 'exec-1' },
      data: { status: 'CLOSED' },
    });

    const response = await patchSession(member.token, initial.id).send({
      startTime: '12:00',
    });
    expect(response.status).toBe(409);
  }, 5_000);

  it('returns 409 for a duplicate type, date and time', async () => {
    await seedDomainData();
    const member = await createActor(['COMMITTEE_MEMBER']);
    await createInitialSession(member.token, { startTime: '09:00' });
    const second = await createInitialSession(member.token, { startTime: '11:00' });

    const response = await patchSession(member.token, second.id).send({
      startTime: '09:00',
    });
    expect(response.status).toBe(409);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app).patch('/sessions/sess-1').send({ startTime: '11:00' });
    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without sesion.editar', async () => {
    const director = await createActor(['PROGRAM_DIRECTOR']);
    const response = await patchSession(director.token, 'sess-1').send({
      startTime: '11:00',
    });
    expect(response.status).toBe(403);
  }, 5_000);
});
