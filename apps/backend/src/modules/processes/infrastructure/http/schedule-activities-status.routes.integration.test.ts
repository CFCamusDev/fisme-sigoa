import { scheduleActivityDtoSchema } from '@sigoa/shared';
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

describe('PATCH /schedule-activities/:id/status (PostgreSQL real, HU-028, T-028-23)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-schedule-patch',
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

  async function seedActivity(params?: {
    executionId?: string;
    executionStatus?: 'PLANNED' | 'IN_PROGRESS' | 'CLOSED' | 'VOIDED';
    activityId?: string;
    status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  }) {
    const executionId = params?.executionId ?? 'exec-1';
    const activityId = params?.activityId ?? 'act-1';

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
        status: params?.executionStatus ?? 'IN_PROGRESS',
        createdBy: 'user-1',
      },
    });
    await prisma.scheduleActivity.create({
      data: {
        id: activityId,
        processExecutionId: executionId,
        number: 1,
        activity: 'Elaborar cronograma',
        responsible: 'Presidente',
        startDate: new Date('2020-01-01T00:00:00.000Z'),
        endDate: new Date('2027-12-31T00:00:00.000Z'),
        status: params?.status ?? 'PENDING',
        actualEndDate: params?.status === 'COMPLETED' ? new Date('2020-02-01T00:00:00.000Z') : null,
        createdBy: 'user-1',
      },
    });

    return { executionId, activityId };
  }

  it('moves a pending activity to in progress', async () => {
    const { activityId } = await seedActivity({
      executionId: 'exec-start',
      activityId: 'act-start',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .patch(`/schedule-activities/${activityId}/status`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(response.status).toBe(200);
    const parsed = scheduleActivityDtoSchema.parse(response.body);
    expect(parsed.status).toBe('IN_PROGRESS');
    expect(parsed.actualEndDate).toBeNull();
  }, 5_000);

  it('completes an in-progress activity storing the actual end date', async () => {
    const { activityId } = await seedActivity({
      executionId: 'exec-complete',
      activityId: 'act-complete',
      status: 'IN_PROGRESS',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .patch(`/schedule-activities/${activityId}/status`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'COMPLETED', actualEndDate: '2020-03-15' });

    expect(response.status).toBe(200);
    const parsed = scheduleActivityDtoSchema.parse(response.body);
    expect(parsed.status).toBe('COMPLETED');
    expect(parsed.actualEndDate).toBe('2020-03-15');
  }, 5_000);

  it('returns 400 for PENDING or for actualEndDate with IN_PROGRESS', async () => {
    const { activityId } = await seedActivity({ executionId: 'exec-400', activityId: 'act-400' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const pendingRes = await request(app)
      .patch(`/schedule-activities/${activityId}/status`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'PENDING' });
    expect(pendingRes.status).toBe(400);

    const dateWithInProgressRes = await request(app)
      .patch(`/schedule-activities/${activityId}/status`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'IN_PROGRESS', actualEndDate: '2020-03-15' });
    expect(dateWithInProgressRes.status).toBe(400);
  }, 5_000);

  it('returns 400 for unknown fields', async () => {
    const { activityId } = await seedActivity({ executionId: 'exec-unk', activityId: 'act-unk' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .patch(`/schedule-activities/${activityId}/status`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'IN_PROGRESS', extra: 1 });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 403 without cronograma.editar', async () => {
    const { activityId } = await seedActivity({ executionId: 'exec-403', activityId: 'act-403' });
    const teacher = await createActor(['TEACHER']);

    const response = await request(app)
      .patch(`/schedule-activities/${activityId}/status`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 404 for an unknown activity', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .patch('/schedule-activities/missing-act/status')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 409 for an invalid transition', async () => {
    const { activityId } = await seedActivity({ executionId: 'exec-409', activityId: 'act-409' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .patch(`/schedule-activities/${activityId}/status`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'COMPLETED', actualEndDate: '2020-03-15' });

    expect(response.status).toBe(409);
  }, 5_000);

  it('returns 409 for a closed execution', async () => {
    const { activityId } = await seedActivity({
      executionId: 'exec-closed',
      executionStatus: 'CLOSED',
      activityId: 'act-closed',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .patch(`/schedule-activities/${activityId}/status`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(response.status).toBe(409);
  }, 5_000);

  it('lets exactly one of two concurrent completions win', async () => {
    const { activityId } = await seedActivity({
      executionId: 'exec-conc-patch',
      activityId: 'act-conc-patch',
      status: 'IN_PROGRESS',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const [r1, r2] = await Promise.all([
      request(app)
        .patch(`/schedule-activities/${activityId}/status`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({ status: 'COMPLETED', actualEndDate: '2020-03-15' }),
      request(app)
        .patch(`/schedule-activities/${activityId}/status`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({ status: 'COMPLETED', actualEndDate: '2020-03-16' }),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
  }, 5_000);

  it('does not deadlock when a save runs at the same time', async () => {
    const { executionId, activityId } = await seedActivity({
      executionId: 'exec-no-deadlock',
      activityId: 'act-no-deadlock',
      status: 'PENDING',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const [patchRes, putRes] = await Promise.all([
      request(app)
        .patch(`/schedule-activities/${activityId}/status`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({ status: 'IN_PROGRESS' }),
      request(app)
        .put(`/process-executions/${executionId}/schedule`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({
          activities: [
            {
              id: activityId,
              activity: 'Elaborar cronograma actualizado',
              responsible: 'Presidente',
            },
          ],
        }),
    ]);

    expect(patchRes.status).toBe(200);
    expect(putRes.status).toBe(200);
  }, 5_000);
});
