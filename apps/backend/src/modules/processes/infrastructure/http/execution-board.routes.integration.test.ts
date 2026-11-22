import { executionBoardResponseSchema, PROCESS_EXECUTION_ID_MAX_LENGTH } from '@sigoa/shared';
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
import { PRECONDITION_LABELS } from '../../domain/entities/process-execution-precondition.js';

describe('Execution board routes (PostgreSQL real, HU-031, T-031-08)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-execution-board',
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

  async function seedExecution(params?: {
    executionId?: string;
    status?: 'PLANNED' | 'IN_PROGRESS' | 'CONSOLIDATING' | 'PENDING_APPROVAL' | 'CLOSED' | 'VOIDED';
    withActivities?: boolean;
    withSessions?: boolean;
  }) {
    const executionId = params?.executionId ?? 'exec-board-1';

    await prisma.program.create({
      data: {
        id: `prog-${executionId}`,
        code: `EPIS-${executionId}`,
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
    await prisma.catalogVersion.create({
      data: {
        id: `cv-${executionId}`,
        programId: `prog-${executionId}`,
        number: 2,
        status: 'APPROVED',
      },
    });
    await prisma.processExecution.create({
      data: {
        id: executionId,
        programId: `prog-${executionId}`,
        type: 'P612',
        name: `Ejecución ${executionId}`,
        year: 2027,
        catalogVersionId: `cv-${executionId}`,
        status: params?.status ?? 'IN_PROGRESS',
        createdBy: 'user-1',
      },
    });

    if (params?.withActivities) {
      await prisma.scheduleActivity.createMany({
        data: [
          {
            id: `act-${executionId}-1`,
            processExecutionId: executionId,
            number: 1,
            activity: 'Actividad completada',
            responsible: 'Comité',
            endDate: '2026-01-10',
            status: 'COMPLETED',
            actualEndDate: '2026-01-10',
            createdBy: 'user-1',
          },
          {
            id: `act-${executionId}-2`,
            processExecutionId: executionId,
            number: 2,
            activity: 'Actividad pendiente',
            responsible: 'Comité',
            endDate: '2099-12-31',
            status: 'PENDING',
            createdBy: 'user-1',
          },
        ],
      });
    }

    if (params?.withSessions) {
      await prisma.session.create({
        data: {
          id: `sess-${executionId}-1`,
          stakeholderType: 'EMPLOYER',
          sessionDate: new Date('2027-03-10T00:00:00.000Z'),
          startTime: '10:00',
          modality: 'VIRTUAL',
          meetingUrl: 'https://meet.example.com/secret-room',
          recordingUrl: 'https://video.example.com/secret-rec',
          createdBy: 'user-1',
          executions: {
            create: {
              processExecutionId: executionId,
              createdBy: 'user-1',
            },
          },
        },
      });
    }

    return executionId;
  }

  it('returns the board of an execution', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const executionId = await seedExecution({
      executionId: 'exec-full',
      status: 'IN_PROGRESS',
      withActivities: true,
      withSessions: true,
    });

    const response = await request(app)
      .get(`/process-executions/${executionId}/board`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const parsed = executionBoardResponseSchema.parse(response.body);
    expect(parsed.execution.id).toBe(executionId);
    expect(parsed.execution.catalogVersionNumber).toBe(2);
    expect(parsed.schedule).toEqual({
      total: 2,
      completed: 1,
      inProgress: 0,
      pending: 1,
      overdue: 0,
      progressPercent: 50,
    });
    expect(parsed.sessions).toEqual({
      total: 1,
      lastSessionDate: '2027-03-10',
      items: [
        {
          id: `sess-${executionId}-1`,
          stakeholderType: 'EMPLOYER',
          sessionDate: '2027-03-10',
          startTime: '10:00',
          modality: 'VIRTUAL',
        },
      ],
    });
    expect(parsed.surveys).toEqual({ available: false });
    expect(parsed.minutes).toEqual({ available: false });
    expect(parsed.results).toEqual({ available: false });
    expect(parsed.nextStatus).toBe('CONSOLIDATING');
  }, 5_000);

  it('returns zeros for an execution without schedule or sessions', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const executionId = await seedExecution({
      executionId: 'exec-empty',
      status: 'CLOSED',
    });

    const response = await request(app)
      .get(`/process-executions/${executionId}/board`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    const parsed = executionBoardResponseSchema.parse(response.body);
    expect(parsed.execution.semesterId).toBeNull();
    expect(parsed.execution.semesterCode).toBeNull();
    expect(parsed.schedule).toEqual({
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      overdue: 0,
      progressPercent: 0,
    });
    expect(parsed.sessions).toEqual({
      total: 0,
      lastSessionDate: null,
      items: [],
    });
    expect(parsed.pending).toEqual([]);
    expect(parsed.nextStatus).toBeNull();
  }, 5_000);

  it('lists the pending preconditions of the next transition', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const executionId = await seedExecution({
      executionId: 'exec-planned',
      status: 'PLANNED',
    });

    const response = await request(app)
      .get(`/process-executions/${executionId}/board`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    const parsed = executionBoardResponseSchema.parse(response.body);
    expect(parsed.nextStatus).toBe('IN_PROGRESS');
    expect(parsed.pending).toEqual([
      {
        code: 'SCHEDULE_HAS_ACTIVITY',
        label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        state: 'UNMET',
        target: 'SCHEDULE',
      },
    ]);
  }, 5_000);

  it('does not expose meeting or recording urls', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const executionId = await seedExecution({
      executionId: 'exec-urls',
      withSessions: true,
    });

    const response = await request(app)
      .get(`/process-executions/${executionId}/board`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('meetingUrl');
    expect(serialized).not.toContain('recordingUrl');
    expect(serialized).not.toContain('secret-room');
    expect(serialized).not.toContain('secret-rec');
  }, 5_000);

  it('returns 400 for an id longer than 64 characters and for unknown query fields', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const longId = 'a'.repeat(PROCESS_EXECUTION_ID_MAX_LENGTH + 1);

    const longIdResponse = await request(app)
      .get(`/process-executions/${longId}/board`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(longIdResponse.status).toBe(400);

    const extraQueryResponse = await request(app)
      .get('/process-executions/exec-1/board?extra=1')
      .set('Authorization', `Bearer ${member.token}`);
    expect(extraQueryResponse.status).toBe(400);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app).get('/process-executions/exec-1/board');
    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without ejecucion.ver', async () => {
    const teacher = await createActor(['TEACHER']);
    const executionId = await seedExecution({ executionId: 'exec-forbidden' });

    const response = await request(app)
      .get(`/process-executions/${executionId}/board`)
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 404 for an unknown execution', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .get('/process-executions/non-existent/board')
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(404);
  }, 5_000);
});
