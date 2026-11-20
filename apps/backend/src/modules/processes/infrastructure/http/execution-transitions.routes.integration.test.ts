import { advanceProcessExecutionResponseSchema, nextTransitionResponseSchema } from '@sigoa/shared';
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
import type { ExecutionPreconditionProvider } from '../../domain/ports/execution-precondition-provider.js';
import { PrismaSchedulePreconditionProvider } from '../prisma/prisma-schedule-precondition-provider.js';

describe('Process execution transitions routes (PostgreSQL real, HU-029, T-029-10)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-execution-transitions',
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
    withScheduleActivity?: boolean;
  }) {
    const executionId = params?.executionId ?? 'exec-1';

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
        number: 1,
        status: 'APPROVED',
      },
    });
    await prisma.processExecution.create({
      data: {
        id: executionId,
        programId: `prog-${executionId}`,
        type: 'P611',
        name: `Ejecución ${executionId}`,
        year: 2027,
        catalogVersionId: `cv-${executionId}`,
        status: params?.status ?? 'PLANNED',
        createdBy: 'user-1',
      },
    });

    if (params?.withScheduleActivity) {
      await prisma.scheduleActivity.create({
        data: {
          id: `act-${executionId}-1`,
          processExecutionId: executionId,
          number: 1,
          activity: 'Elaborar cronograma',
          responsible: 'Presidente',
          status: 'PENDING',
          createdBy: 'user-1',
        },
      });
    }

    return executionId;
  }

  describe('POST /process-executions/:id/advance', () => {
    it('moves a planned execution with a schedule to IN_PROGRESS', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);
      const executionId = await seedExecution({ withScheduleActivity: true });

      const response = await request(app)
        .post(`/process-executions/${executionId}/advance`)
        .set('Authorization', `Bearer ${president.accessToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const parsed = advanceProcessExecutionResponseSchema.parse(response.body);
      expect(parsed.executionId).toBe(executionId);
      expect(parsed.previousStatus).toBe('PLANNED');
      expect(parsed.status).toBe('IN_PROGRESS');

      const row = await prisma.processExecution.findUniqueOrThrow({
        where: { id: executionId },
      });
      expect(row.status).toBe('IN_PROGRESS');
    }, 5_000);

    it('returns 409 with the unmet preconditions when the minutes are not signed', async () => {
      const fakeMinutesProvider: ExecutionPreconditionProvider = {
        codes: ['SESSIONS_SURVEYS_CLOSED', 'SESSIONS_MINUTES_SIGNED'],
        async evaluate() {
          return [
            {
              code: 'SESSIONS_SURVEYS_CLOSED',
              label: PRECONDITION_LABELS.SESSIONS_SURVEYS_CLOSED,
              state: 'MET',
            },
            {
              code: 'SESSIONS_MINUTES_SIGNED',
              label: PRECONDITION_LABELS.SESSIONS_MINUTES_SIGNED,
              state: 'UNMET',
            },
          ];
        },
      };

      const appWithMinutesProvider = createApp({
        env,
        setupRoutes: (instance) => {
          setupAppRoutes(instance, {
            unitOfWork: uow,
            auditLogger: auditServices.auditLogger,
            dbProvider: uow,
            env,
            emailSender,
            processPreconditionProviders: [
              new PrismaSchedulePreconditionProvider(uow),
              fakeMinutesProvider,
            ],
          });
        },
      });

      const president = await createActor(['COMMITTEE_PRESIDENT']);
      const executionId = await seedExecution({ status: 'IN_PROGRESS' });

      const response = await request(appWithMinutesProvider)
        .post(`/process-executions/${executionId}/advance`)
        .set('Authorization', `Bearer ${president.accessToken}`)
        .send({});

      expect(response.status).toBe(409);
      expect(response.body.error.details).toEqual([
        {
          path: 'SESSIONS_MINUTES_SIGNED',
          message: PRECONDITION_LABELS.SESSIONS_MINUTES_SIGNED,
        },
      ]);
    }, 5_000);

    it('reports not verifiable preconditions when no provider is registered', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);
      const executionId = await seedExecution({ status: 'IN_PROGRESS' });

      const response = await request(app)
        .post(`/process-executions/${executionId}/advance`)
        .set('Authorization', `Bearer ${president.accessToken}`)
        .send({});

      expect(response.status).toBe(409);
      expect(response.body.error.details).toEqual([
        {
          path: 'SESSIONS_SURVEYS_CLOSED',
          message: `${PRECONDITION_LABELS.SESSIONS_SURVEYS_CLOSED} (no verificable)`,
        },
        {
          path: 'SESSIONS_MINUTES_SIGNED',
          message: `${PRECONDITION_LABELS.SESSIONS_MINUTES_SIGNED} (no verificable)`,
        },
      ]);
    }, 5_000);

    it('writes one audit row with before and after status', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);
      const executionId = await seedExecution({ withScheduleActivity: true });

      const response = await request(app)
        .post(`/process-executions/${executionId}/advance`)
        .set('Authorization', `Bearer ${president.accessToken}`)
        .send({});

      expect(response.status).toBe(200);

      const auditRows = await prisma.auditLog.findMany({
        where: { entity: 'ProcessExecution', entityId: executionId, action: 'STATE_CHANGE' },
      });
      expect(auditRows).toHaveLength(1);
      expect(auditRows[0]?.actor).toBe(president.userId);
      expect((auditRows[0]?.before as Record<string, unknown>)?.status).toBe('PLANNED');
      expect((auditRows[0]?.after as Record<string, unknown>)?.status).toBe('IN_PROGRESS');
    }, 5_000);

    it('returns 400 for a non-empty body or an id over 64 characters', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);
      const executionId = await seedExecution({ withScheduleActivity: true });

      const nonEmptyBody = await request(app)
        .post(`/process-executions/${executionId}/advance`)
        .set('Authorization', `Bearer ${president.accessToken}`)
        .send({ unexpected: true });
      expect(nonEmptyBody.status).toBe(400);

      const longId = 'a'.repeat(65);
      const invalidId = await request(app)
        .post(`/process-executions/${longId}/advance`)
        .set('Authorization', `Bearer ${president.accessToken}`)
        .send({});
      expect(invalidId.status).toBe(400);
    }, 5_000);

    it('returns 401 without a token', async () => {
      const executionId = await seedExecution({ withScheduleActivity: true });

      const response = await request(app)
        .post(`/process-executions/${executionId}/advance`)
        .send({});

      expect(response.status).toBe(401);
    }, 5_000);

    it('returns 403 without ejecucion.avanzar', async () => {
      const member = await createActor(['COMMITTEE_MEMBER']);
      const executionId = await seedExecution({ withScheduleActivity: true });

      const response = await request(app)
        .post(`/process-executions/${executionId}/advance`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({});

      expect(response.status).toBe(403);
    }, 5_000);

    it('returns 404 for an unknown execution', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await request(app)
        .post('/process-executions/missing-exec/advance')
        .set('Authorization', `Bearer ${president.accessToken}`)
        .send({});

      expect(response.status).toBe(404);
    }, 5_000);

    it('returns 409 from PENDING_APPROVAL, CLOSED or VOIDED', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      for (const status of ['PENDING_APPROVAL', 'CLOSED', 'VOIDED'] as const) {
        const executionId = await seedExecution({
          executionId: `exec-${status.toLowerCase()}`,
          status,
        });

        const response = await request(app)
          .post(`/process-executions/${executionId}/advance`)
          .set('Authorization', `Bearer ${president.accessToken}`)
          .send({});

        expect(response.status).toBe(409);
      }
    }, 5_000);

    it('reports an execution without schedule as unmet', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);
      const executionId = await seedExecution({ withScheduleActivity: false });

      const response = await request(app)
        .post(`/process-executions/${executionId}/advance`)
        .set('Authorization', `Bearer ${president.accessToken}`)
        .send({});

      expect(response.status).toBe(409);
      expect(response.body.error.details).toEqual([
        {
          path: 'SCHEDULE_HAS_ACTIVITY',
          message: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
        },
      ]);
    }, 5_000);

    it('lets exactly one of two concurrent advances from PLANNED win', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);
      const executionId = await seedExecution({ withScheduleActivity: true });

      const [first, second] = await Promise.all([
        request(app)
          .post(`/process-executions/${executionId}/advance`)
          .set('Authorization', `Bearer ${president.accessToken}`)
          .send({}),
        request(app)
          .post(`/process-executions/${executionId}/advance`)
          .set('Authorization', `Bearer ${president.accessToken}`)
          .send({}),
      ]);

      const statuses = [first.status, second.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 409]);

      const auditRows = await prisma.auditLog.findMany({
        where: { entity: 'ProcessExecution', entityId: executionId, action: 'STATE_CHANGE' },
      });
      expect(auditRows).toHaveLength(1);
    }, 5_000);

    it('does not deadlock when a schedule save runs at the same time', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);
      const executionId = await seedExecution({ withScheduleActivity: true });

      const [advanceResponse, scheduleResponse] = await Promise.all([
        request(app)
          .post(`/process-executions/${executionId}/advance`)
          .set('Authorization', `Bearer ${president.accessToken}`)
          .send({}),
        request(app)
          .put(`/process-executions/${executionId}/schedule`)
          .set('Authorization', `Bearer ${president.accessToken}`)
          .send({
            activities: [
              {
                number: 1,
                activity: 'Elaborar cronograma actualizado',
                responsible: 'Presidente',
                goal: 'Anexo 1',
              },
            ],
          }),
      ]);

      expect(advanceResponse.status).toBe(200);
      expect(scheduleResponse.status).toBe(200);
    }, 5_000);
  });

  describe('GET /process-executions/:id/next-transition', () => {
    it('returns the next transition and preconditions', async () => {
      const member = await createActor(['COMMITTEE_MEMBER']);
      const executionId = await seedExecution({ withScheduleActivity: true });

      const response = await request(app)
        .get(`/process-executions/${executionId}/next-transition`)
        .set('Authorization', `Bearer ${member.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const parsed = nextTransitionResponseSchema.parse(response.body);
      expect(parsed).toEqual({
        executionId,
        status: 'PLANNED',
        nextStatus: 'IN_PROGRESS',
        preconditions: [
          {
            code: 'SCHEDULE_HAS_ACTIVITY',
            label: PRECONDITION_LABELS.SCHEDULE_HAS_ACTIVITY,
            state: 'MET',
          },
        ],
        canAdvance: true,
      });
    }, 5_000);

    it('returns a null next status for a closed execution', async () => {
      const member = await createActor(['COMMITTEE_MEMBER']);
      const executionId = await seedExecution({ status: 'CLOSED' });

      const response = await request(app)
        .get(`/process-executions/${executionId}/next-transition`)
        .set('Authorization', `Bearer ${member.accessToken}`);

      expect(response.status).toBe(200);
      const parsed = nextTransitionResponseSchema.parse(response.body);
      expect(parsed).toEqual({
        executionId,
        status: 'CLOSED',
        nextStatus: null,
        preconditions: [],
        canAdvance: false,
      });
    }, 5_000);

    it('returns 403 without ejecucion.ver', async () => {
      const teacher = await createActor(['TEACHER']);
      const executionId = await seedExecution({ withScheduleActivity: true });

      const response = await request(app)
        .get(`/process-executions/${executionId}/next-transition`)
        .set('Authorization', `Bearer ${teacher.accessToken}`);

      expect(response.status).toBe(403);
    }, 5_000);

    it('returns 404 for an unknown execution', async () => {
      const member = await createActor(['COMMITTEE_MEMBER']);

      const response = await request(app)
        .get('/process-executions/missing-exec/next-transition')
        .set('Authorization', `Bearer ${member.accessToken}`);

      expect(response.status).toBe(404);
    }, 5_000);
  });
});
