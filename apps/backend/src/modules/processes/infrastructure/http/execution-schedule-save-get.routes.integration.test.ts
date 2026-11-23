import { scheduleResponseSchema } from '@sigoa/shared';
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

describe('PUT and GET /process-executions/:id/schedule (PostgreSQL real, HU-028, T-028-22)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-schedule-save-get',
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

  async function seedExecution(
    id = 'exec-1',
    status: 'PLANNED' | 'IN_PROGRESS' | 'CLOSED' | 'VOIDED' = 'PLANNED',
  ) {
    await prisma.program.create({
      data: {
        id: `prog-${id}`,
        code: `EPIS-${id}`,
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
    await prisma.catalogVersion.create({
      data: {
        id: `cv-${id}`,
        programId: `prog-${id}`,
        number: 1,
        status: 'APPROVED',
      },
    });
    await prisma.processExecution.create({
      data: {
        id,
        programId: `prog-${id}`,
        type: 'P611',
        name: `Ejecución ${id}`,
        year: 2027,
        catalogVersionId: `cv-${id}`,
        status,
        createdBy: 'user-1',
      },
    });
    return id;
  }

  it('saves new, updated and reordered activities', async () => {
    const executionId = await seedExecution('exec-save-reorder');
    const member = await createActor(['COMMITTEE_MEMBER']);

    const initial = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        activities: [
          { activity: 'Paso 1', responsible: 'Presidente' },
          { activity: 'Paso 2', responsible: 'Decano' },
        ],
      });

    expect(initial.status).toBe(200);
    const firstItems = scheduleResponseSchema.parse(initial.body).items;
    expect(firstItems).toHaveLength(2);

    const updated = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        activities: [
          {
            id: firstItems[1]?.id,
            activity: 'Paso 2 editado',
            responsible: 'Decano',
            goal: 'Resolución',
          },
          {
            id: firstItems[0]?.id,
            activity: 'Paso 1',
            responsible: 'Presidente',
          },
          {
            activity: 'Paso 3 nuevo',
            responsible: 'Comité',
          },
        ],
      });

    expect(updated.status).toBe(200);
    const reorderedItems = scheduleResponseSchema.parse(updated.body).items;
    expect(reorderedItems.map((item) => item.number)).toEqual([1, 2, 3]);
    expect(reorderedItems[0]?.id).toBe(firstItems[1]?.id);
    expect(reorderedItems[0]?.activity).toBe('Paso 2 editado');
    expect(reorderedItems[1]?.id).toBe(firstItems[0]?.id);
    expect(reorderedItems[2]?.activity).toBe('Paso 3 nuevo');
  }, 5_000);

  it('accepts activities without dates, goal or indicator', async () => {
    const executionId = await seedExecution('exec-nullable');
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        activities: [
          {
            activity: 'Sin opcionales',
            responsible: 'Presidente',
            goal: null,
            indicator: null,
            startDate: null,
            endDate: null,
          },
        ],
      });

    expect(response.status).toBe(200);
    const parsed = scheduleResponseSchema.parse(response.body);
    expect(parsed.items[0]?.goal).toBeNull();
    expect(parsed.items[0]?.indicator).toBeNull();
    expect(parsed.items[0]?.startDate).toBeNull();
    expect(parsed.items[0]?.endDate).toBeNull();
  }, 5_000);

  it('accepts an empty list when all activities are pending', async () => {
    const executionId = await seedExecution('exec-empty-list');
    const member = await createActor(['COMMITTEE_MEMBER']);

    await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        activities: [{ activity: 'Temporal', responsible: 'Presidente' }],
      });

    const cleared = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ activities: [] });

    expect(cleared.status).toBe(200);
    expect(scheduleResponseSchema.parse(cleared.body).items).toEqual([]);
  }, 5_000);

  it('returns 400 for more than 50 activities', async () => {
    const executionId = await seedExecution('exec-over-50');
    const member = await createActor(['COMMITTEE_MEMBER']);

    const activities = Array.from({ length: 51 }, (_, index) => ({
      activity: `Actividad ${index + 1}`,
      responsible: 'Presidente',
    }));

    const response = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ activities });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for unknown fields, empty or oversized text, invalid dates or an end before the start', async () => {
    const executionId = await seedExecution('exec-bad-inputs');
    const member = await createActor(['COMMITTEE_MEMBER']);

    const badPayloads = [
      { activities: [], extra: true },
      { activities: [{ activity: '   ', responsible: 'Presidente' }] },
      { activities: [{ activity: 'A'.repeat(301), responsible: 'Presidente' }] },
      { activities: [{ activity: 'Válida', responsible: 'Presidente', startDate: '2027-02-29' }] },
      {
        activities: [
          {
            activity: 'Válida',
            responsible: 'Presidente',
            startDate: '2027-05-10',
            endDate: '2027-05-01',
          },
        ],
      },
    ];

    for (const payload of badPayloads) {
      const response = await request(app)
        .put(`/process-executions/${executionId}/schedule`)
        .set('Authorization', `Bearer ${member.token}`)
        .send(payload);
      expect(response.status).toBe(400);
    }
  }, 5_000);

  it('returns 403 without cronograma.editar', async () => {
    const executionId = await seedExecution('exec-put-403');
    const teacher = await createActor(['TEACHER']);

    const response = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ activities: [] });

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 404 for an unknown execution', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .put('/process-executions/missing-exec/schedule')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ activities: [] });

    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 409 when removing an activity in progress or completed', async () => {
    const executionId = await seedExecution('exec-remove-in-use');
    const member = await createActor(['COMMITTEE_MEMBER']);

    await prisma.scheduleActivity.create({
      data: {
        id: 'act-in-progress',
        processExecutionId: executionId,
        number: 1,
        activity: 'En curso',
        responsible: 'Presidente',
        status: 'IN_PROGRESS',
        createdBy: 'user-1',
      },
    });

    const response = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ activities: [] });

    expect(response.status).toBe(409);
  }, 5_000);

  it('rejects an id of another execution', async () => {
    const execA = await seedExecution('exec-foreign-a');
    const execB = await seedExecution('exec-foreign-b');
    const member = await createActor(['COMMITTEE_MEMBER']);

    await prisma.scheduleActivity.create({
      data: {
        id: 'act-of-a',
        processExecutionId: execA,
        number: 1,
        activity: 'De A',
        responsible: 'Presidente',
        createdBy: 'user-1',
      },
    });

    const response = await request(app)
      .put(`/process-executions/${execB}/schedule`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        activities: [{ id: 'act-of-a', activity: 'Intento ajeno', responsible: 'Presidente' }],
      });

    expect(response.status).toBe(400);
  }, 5_000);

  it('serializes two concurrent saves without duplicated numbers', async () => {
    const executionId = await seedExecution('exec-conc-put');
    const member = await createActor(['COMMITTEE_MEMBER']);

    const [r1, r2] = await Promise.all([
      request(app)
        .put(`/process-executions/${executionId}/schedule`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({
          activities: [
            { activity: 'Conjunto A 1', responsible: 'Presidente' },
            { activity: 'Conjunto A 2', responsible: 'Presidente' },
          ],
        }),
      request(app)
        .put(`/process-executions/${executionId}/schedule`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({
          activities: [
            { activity: 'Conjunto B 1', responsible: 'Decano' },
            { activity: 'Conjunto B 2', responsible: 'Decano' },
          ],
        }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const saved = await prisma.scheduleActivity.findMany({
      where: { processExecutionId: executionId },
      orderBy: { number: 'asc' },
    });
    expect(saved.map((item) => item.number)).toEqual([1, 2]);
  }, 5_000);

  it('saves 50 activities within the time budget', async () => {
    const executionId = await seedExecution('exec-50');
    const member = await createActor(['COMMITTEE_MEMBER']);

    const activities = Array.from({ length: 50 }, (_, index) => ({
      activity: `Actividad masiva ${index + 1}`,
      responsible: 'Presidente',
    }));

    const response = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ activities });

    expect(response.status).toBe(200);
    expect(scheduleResponseSchema.parse(response.body).items).toHaveLength(50);
  }, 5_000);

  it('returns the activities ordered by number', async () => {
    const executionId = await seedExecution('exec-get-order');
    const member = await createActor(['COMMITTEE_MEMBER']);

    await prisma.scheduleActivity.createMany({
      data: [
        {
          id: 'act-get-2',
          processExecutionId: executionId,
          number: 2,
          activity: 'Segunda',
          responsible: 'Decano',
          createdBy: 'user-1',
        },
        {
          id: 'act-get-1',
          processExecutionId: executionId,
          number: 1,
          activity: 'Primera',
          responsible: 'Presidente',
          createdBy: 'user-1',
        },
      ],
    });

    const response = await request(app)
      .get(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    const parsed = scheduleResponseSchema.parse(response.body);
    expect(parsed.items.map((item) => item.number)).toEqual([1, 2]);
    expect(parsed.items[0]?.id).toBe('act-get-1');
  }, 5_000);

  it('flags a past-due activity as overdue', async () => {
    const executionId = await seedExecution('exec-overdue');
    const member = await createActor(['COMMITTEE_MEMBER']);

    await prisma.scheduleActivity.create({
      data: {
        id: 'act-overdue',
        processExecutionId: executionId,
        number: 1,
        activity: 'Actividad vencida',
        responsible: 'Presidente',
        startDate: new Date('2020-01-01T00:00:00.000Z'),
        endDate: new Date('2020-01-10T00:00:00.000Z'),
        status: 'PENDING',
        createdBy: 'user-1',
      },
    });

    const response = await request(app)
      .get(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    const parsed = scheduleResponseSchema.parse(response.body);
    expect(parsed.items[0]?.isOverdue).toBe(true);
  }, 5_000);

  it('returns an empty list', async () => {
    const executionId = await seedExecution('exec-get-empty');
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .get(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    expect(scheduleResponseSchema.parse(response.body).items).toEqual([]);
  }, 5_000);

  it('returns 403 without cronograma.ver', async () => {
    const executionId = await seedExecution('exec-get-403');
    const actorWithoutPerm = await createActor([]);

    const response = await request(app)
      .get(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${actorWithoutPerm.token}`);

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 404 for an unknown execution on GET', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .get('/process-executions/missing-exec/schedule')
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 409 when saving or changing activity status of a voided execution', async () => {
    const executionId = await seedExecution('exec-voided', 'VOIDED');
    const member = await createActor(['COMMITTEE_MEMBER']);

    await prisma.scheduleActivity.create({
      data: {
        id: 'act-voided-1',
        processExecutionId: executionId,
        number: 1,
        activity: 'Actividad congelada',
        responsible: 'Presidente',
        status: 'PENDING',
        createdBy: 'user-1',
      },
    });

    const saveResponse = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        activities: [{ activity: 'Cambio', responsible: 'Presidente' }],
      });

    expect(saveResponse.status).toBe(409);

    const statusResponse = await request(app)
      .patch('/schedule-activities/act-voided-1/status')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(statusResponse.status).toBe(409);
  }, 5_000);

  it('returns 403 when saving schedule without cronograma.editar', async () => {
    const executionId = await seedExecution('exec-save-403', 'VOIDED');
    const actorWithoutPerm = await createActor([]);

    const response = await request(app)
      .put(`/process-executions/${executionId}/schedule`)
      .set('Authorization', `Bearer ${actorWithoutPerm.token}`)
      .send({
        activities: [{ activity: 'Cambio', responsible: 'Presidente' }],
      });

    expect(response.status).toBe(403);
  }, 5_000);
});
