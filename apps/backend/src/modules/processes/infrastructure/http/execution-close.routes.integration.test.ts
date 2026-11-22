import { closeProcessExecutionResponseSchema } from '@sigoa/shared';
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

describe('POST /process-executions/:id/close (PostgreSQL real, HU-030, T-030-14)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-execution-close',
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
    type?: 'P611' | 'P621';
    status?: 'PLANNED' | 'IN_PROGRESS' | 'CONSOLIDATING' | 'PENDING_APPROVAL' | 'CLOSED' | 'VOIDED';
    withApprovedResolution?: boolean;
  }) {
    const executionId = params?.executionId ?? 'exec-1';
    const type = params?.type ?? 'P611';

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
        type,
        name: `Ejecución ${executionId}`,
        year: 2027,
        catalogVersionId: `cv-${executionId}`,
        status: params?.status ?? 'PENDING_APPROVAL',
        createdBy: 'user-1',
      },
    });

    if (params?.withApprovedResolution) {
      await prisma.storedFile.create({
        data: {
          id: `file-${executionId}`,
          provider: 'cloudinary',
          publicId: `resolutions/${executionId}`,
          url: `https://example.test/${executionId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          sha256: `sha-${executionId}`,
        },
      });
      await prisma.resolution.create({
        data: {
          id: `res-${executionId}`,
          type: type === 'P621' ? 'GRADUATE_ATTRIBUTE' : 'EDUCATIONAL_OBJECTIVE',
          number: `R-001-${executionId}`,
          issuedOn: new Date('2027-01-15T00:00:00.000Z'),
          status: 'APPROVED',
          catalogVersionId: `cv-${executionId}`,
          pdfFileId: `file-${executionId}`,
          approvedAt: new Date('2027-01-16T00:00:00.000Z'),
          approvedBy: 'user-1',
          createdBy: 'user-1',
        },
      });
    }

    return executionId;
  }

  it('closes the execution when its resolution is approved', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({
      status: 'PENDING_APPROVAL',
      withApprovedResolution: true,
    });

    const response = await request(app)
      .post(`/process-executions/${executionId}/close`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const parsed = closeProcessExecutionResponseSchema.parse(response.body);
    expect(parsed.executionId).toBe(executionId);
    expect(parsed.previousStatus).toBe('PENDING_APPROVAL');
    expect(parsed.status).toBe('CLOSED');

    const row = await prisma.processExecution.findUniqueOrThrow({ where: { id: executionId } });
    expect(row.status).toBe('CLOSED');
  }, 5_000);

  it('returns 409 with the unmet precondition when the resolution is not approved', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({
      status: 'PENDING_APPROVAL',
      withApprovedResolution: false,
    });

    const response = await request(app)
      .post(`/process-executions/${executionId}/close`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.details).toEqual([
      {
        path: 'RESOLUTION_APPROVED',
        message: 'La resolución que aprueba el proceso está aprobada con su PDF',
      },
    ]);

    const row = await prisma.processExecution.findUniqueOrThrow({ where: { id: executionId } });
    expect(row.status).toBe('PENDING_APPROVAL');
  }, 5_000);

  it('accepts an empty or missing body', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({
      status: 'PENDING_APPROVAL',
      withApprovedResolution: true,
    });

    const response = await request(app)
      .post(`/process-executions/${executionId}/close`)
      .set('Authorization', `Bearer ${president.token}`)
      .send();

    expect(response.status).toBe(200);
    expect(closeProcessExecutionResponseSchema.parse(response.body).status).toBe('CLOSED');
  }, 5_000);

  it('rejects unknown body fields with 400', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({
      status: 'PENDING_APPROVAL',
      withApprovedResolution: true,
    });

    const response = await request(app)
      .post(`/process-executions/${executionId}/close`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({ extra: true });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for an id over 64 characters', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await request(app)
      .post(`/process-executions/${'a'.repeat(65)}/close`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({});

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app).post('/process-executions/exec-1/close').send({});

    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without ejecucion.cerrar', async () => {
    const member = await createActor(['QUALITY_COMMITTEE_MEMBER']);
    const executionId = await seedExecution({
      status: 'PENDING_APPROVAL',
      withApprovedResolution: true,
    });

    const response = await request(app)
      .post(`/process-executions/${executionId}/close`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({});

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 404 for an unknown execution', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await request(app)
      .post('/process-executions/missing-exec/close')
      .set('Authorization', `Bearer ${president.token}`)
      .send({});

    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 409 for an execution that is not pending approval', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({
      status: 'IN_PROGRESS',
      withApprovedResolution: true,
    });

    const response = await request(app)
      .post(`/process-executions/${executionId}/close`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({});

    expect(response.status).toBe(409);
  }, 5_000);

  it('writes one audit row with before and after status', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({
      status: 'PENDING_APPROVAL',
      withApprovedResolution: true,
    });

    const response = await request(app)
      .post(`/process-executions/${executionId}/close`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({});

    expect(response.status).toBe(200);

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'ProcessExecution', entityId: executionId, action: 'STATE_CHANGE' },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.before).toMatchObject({ status: 'PENDING_APPROVAL' });
    expect(audits[0]?.after).toMatchObject({ status: 'CLOSED' });
  }, 5_000);

  it('lets exactly one of five concurrent closes win and audits once', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({
      status: 'PENDING_APPROVAL',
      withApprovedResolution: true,
    });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post(`/process-executions/${executionId}/close`)
          .set('Authorization', `Bearer ${president.token}`)
          .send({}),
      ),
    );

    const successes = responses.filter((res) => res.status === 200);
    const conflicts = responses.filter((res) => res.status === 409);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(4);

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'ProcessExecution', entityId: executionId, action: 'STATE_CHANGE' },
    });
    expect(audits).toHaveLength(1);
  }, 5_000);
});
