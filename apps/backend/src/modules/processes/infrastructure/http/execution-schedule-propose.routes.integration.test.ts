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

describe('POST /process-executions/:id/schedule/propose (PostgreSQL real, HU-028, T-028-21)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-schedule-propose',
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
    id?: string;
    type?: 'P611' | 'P612' | 'P621';
    status?: 'PLANNED' | 'IN_PROGRESS' | 'CLOSED' | 'VOIDED';
  }) {
    const id = params?.id ?? 'exec-1';
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
        type: params?.type ?? 'P611',
        name: `Ejecución ${id}`,
        year: 2027,
        catalogVersionId: `cv-${id}`,
        status: params?.status ?? 'PLANNED',
        createdBy: 'user-1',
      },
    });
    return id;
  }

  it('creates the activities of the execution type', async () => {
    const executionId = await seedExecution({ type: 'P611' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .post(`/process-executions/${executionId}/schedule/propose`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({});

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const parsed = scheduleResponseSchema.parse(response.body);
    expect(parsed.items).toHaveLength(10);
    expect(parsed.items.map((item) => item.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  }, 5_000);

  it('proposes without a body', async () => {
    const executionId = await seedExecution({ id: 'exec-no-body', type: 'P612' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .post(`/process-executions/${executionId}/schedule/propose`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(201);
    const parsed = scheduleResponseSchema.parse(response.body);
    expect(parsed.items).toHaveLength(9);
  }, 5_000);

  it('returns 400 for a non-empty body', async () => {
    const executionId = await seedExecution({ id: 'exec-non-empty' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .post(`/process-executions/${executionId}/schedule/propose`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ unexpected: true });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for an id over 64 characters', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .post(`/process-executions/${'x'.repeat(65)}/schedule/propose`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({});

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app)
      .post('/process-executions/exec-1/schedule/propose')
      .send({});
    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without cronograma.editar', async () => {
    const executionId = await seedExecution({ id: 'exec-403' });
    const teacher = await createActor(['TEACHER']);

    const response = await request(app)
      .post(`/process-executions/${executionId}/schedule/propose`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({});

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 404 for an unknown execution', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .post('/process-executions/missing-exec/schedule/propose')
      .set('Authorization', `Bearer ${member.token}`)
      .send({});

    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 409 when the schedule already exists', async () => {
    const executionId = await seedExecution({ id: 'exec-dup' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const first = await request(app)
      .post(`/process-executions/${executionId}/schedule/propose`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({});
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/process-executions/${executionId}/schedule/propose`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({});
    expect(second.status).toBe(409);
  }, 5_000);

  it('returns 409 for a closed execution', async () => {
    const executionId = await seedExecution({ id: 'exec-closed', status: 'CLOSED' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .post(`/process-executions/${executionId}/schedule/propose`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({});

    expect(response.status).toBe(409);
  }, 5_000);

  it('lets exactly one of two concurrent proposals win', async () => {
    const executionId = await seedExecution({ id: 'exec-conc', type: 'P611' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const [r1, r2] = await Promise.all([
      request(app)
        .post(`/process-executions/${executionId}/schedule/propose`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({}),
      request(app)
        .post(`/process-executions/${executionId}/schedule/propose`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({}),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const count = await prisma.scheduleActivity.count({
      where: { processExecutionId: executionId },
    });
    expect(count).toBe(10);
  }, 5_000);
});
