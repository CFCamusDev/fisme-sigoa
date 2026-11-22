import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const COVERED_CONTENT_OPERATIONS = new Set([
  'POST /process-executions/{id}/schedule/propose',
  'PUT /process-executions/{id}/schedule',
  'PATCH /schedule-activities/{id}/status',
  'POST /sessions',
  'PATCH /sessions/{id}',
  'PUT /sessions/{id}/attendees',
]);

const EXEMPT_OPERATIONS: ReadonlyMap<string, string> = new Map([
  ['POST /process-executions', 'Crea una ejecución nueva (siempre inicia en PLANNED)'],
  ['POST /process-executions/{id}/advance', 'Transición de estado con su propia máquina'],
  ['POST /process-executions/{id}/close', 'Transición de cierre hacia CLOSED'],
  ['POST /process-executions/{id}/void', 'Transición de anulación hacia VOIDED'],
]);

describe('Execution content immutability (PostgreSQL real, HU-030, T-030-10)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-execution-immutability',
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

  async function seedFrozenExecutionWithContent(status: 'CLOSED' | 'VOIDED') {
    const executionId = `exec-${status.toLowerCase()}`;
    const activityId = `act-${status.toLowerCase()}`;
    const sessionId = `sess-${status.toLowerCase()}`;

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
        name: `Ejecución ${status}`,
        year: 2027,
        catalogVersionId: `cv-${executionId}`,
        status,
        voidReason: status === 'VOIDED' ? 'Motivo previo' : null,
        createdBy: 'user-1',
      },
    });
    await prisma.scheduleActivity.create({
      data: {
        id: activityId,
        processExecutionId: executionId,
        number: 1,
        activity: 'Actividad original',
        responsible: 'Presidente',
        status: 'PENDING',
        createdBy: 'user-1',
      },
    });
    await prisma.session.create({
      data: {
        id: sessionId,
        stakeholderType: 'GRADUATE',
        sessionDate: new Date('2027-04-10T00:00:00.000Z'),
        startTime: '10:00',
        modality: 'VIRTUAL',
        meetingUrl: 'https://meet.example.test/original',
        recordingUrl: 'https://meet.example.test/recording',
        createdBy: 'user-1',
        executions: {
          create: {
            processExecutionId: executionId,
            createdBy: 'user-1',
          },
        },
      },
    });

    return { executionId, activityId, sessionId };
  }

  async function assertAllContentMutationsRejected(status: 'CLOSED' | 'VOIDED') {
    const president = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: ['COMMITTEE_PRESIDENT'],
    });
    const { executionId, activityId, sessionId } = await seedFrozenExecutionWithContent(status);

    const proposeRes = await request(app)
      .post(`/process-executions/${executionId}/schedule/propose`)
      .set('Authorization', `Bearer ${president.token}`)
      .send();
    expect(proposeRes.status).toBe(409);

    const saveScheduleRes = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({
        activities: [
          {
            activity: 'Actividad alterada',
            responsible: 'Otro',
          },
        ],
      });
    expect(saveScheduleRes.status).toBe(409);

    const patchActivityRes = await request(app)
      .patch(`/schedule-activities/${activityId}/status`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({ status: 'COMPLETED' });
    expect(patchActivityRes.status).toBe(409);

    const createSessionRes = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${president.token}`)
      .send({
        stakeholderType: 'GRADUATE',
        sessionDate: '2027-05-01',
        startTime: '15:00',
        modality: 'VIRTUAL',
        meetingUrl: 'https://meet.example.test/new',
        recordingUrl: 'https://meet.example.test/new-recording',
        processExecutionIds: [executionId],
      });
    expect(createSessionRes.status).toBe(409);

    const updateSessionRes = await request(app)
      .patch(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({
        startTime: '16:00',
      });
    expect(updateSessionRes.status).toBe(409);

    const attendeesRes = await request(app)
      .put(`/sessions/${sessionId}/attendees`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({
        attendees: [],
      });
    expect(attendeesRes.status).toBe(409);

    return { executionId, activityId, sessionId };
  }

  it('rejects every content mutation of a closed execution', async () => {
    await assertAllContentMutationsRejected('CLOSED');
  }, 5_000);

  it('rejects every content mutation of a voided execution', async () => {
    await assertAllContentMutationsRejected('VOIDED');
  }, 5_000);

  it('leaves the schedule and the sessions unchanged after the rejected calls', async () => {
    const { executionId, activityId, sessionId } =
      await assertAllContentMutationsRejected('CLOSED');

    const activities = await prisma.scheduleActivity.findMany({
      where: { processExecutionId: executionId },
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]?.id).toBe(activityId);
    expect(activities[0]?.activity).toBe('Actividad original');
    expect(activities[0]?.status).toBe('PENDING');

    const sessions = await prisma.session.findMany({
      where: { executions: { some: { processExecutionId: executionId } } },
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe(sessionId);
    expect(sessions[0]?.startTime).toBe('10:00');
  }, 5_000);

  it('covers every mutating operation that targets an execution', () => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const openapiPath = path.resolve(currentDir, '../../../../../openapi/openapi.json');
    const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8')) as {
      paths: Record<string, Record<string, unknown>>;
    };

    const mutatingMethods = new Set(['post', 'put', 'patch', 'delete']);
    const targetPrefixes = ['/process-executions', '/schedule-activities', '/sessions'];
    const unclassified: string[] = [];

    for (const [routePath, methods] of Object.entries(spec.paths)) {
      if (!targetPrefixes.some((prefix) => routePath.startsWith(prefix))) {
        continue;
      }
      for (const method of Object.keys(methods)) {
        if (!mutatingMethods.has(method.toLowerCase())) {
          continue;
        }
        const operation = `${method.toUpperCase()} ${routePath}`;
        if (!COVERED_CONTENT_OPERATIONS.has(operation) && !EXEMPT_OPERATIONS.has(operation)) {
          unclassified.push(operation);
        }
      }
    }

    expect(unclassified).toEqual([]);
  }, 5_000);
});
