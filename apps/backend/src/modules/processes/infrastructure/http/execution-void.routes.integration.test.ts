import { voidProcessExecutionResponseSchema } from '@sigoa/shared';
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

describe('POST /process-executions/:id/void (PostgreSQL real, HU-030, T-030-15)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-execution-void',
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
    voidReason?: string | null;
    withApprovedResolution?: boolean;
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
        status: params?.status ?? 'IN_PROGRESS',
        voidReason: params?.voidReason ?? null,
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
          type: 'EDUCATIONAL_OBJECTIVE',
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

  it('voids the execution and stores the reason', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({ status: 'IN_PROGRESS' });

    const response = await request(app)
      .post(`/process-executions/${executionId}/void`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({ reason: '  Ejecución duplicada por error  ' });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const parsed = voidProcessExecutionResponseSchema.parse(response.body);
    expect(parsed.executionId).toBe(executionId);
    expect(parsed.previousStatus).toBe('IN_PROGRESS');
    expect(parsed.status).toBe('VOIDED');
    expect(parsed.voidReason).toBe('Ejecución duplicada por error');

    const row = await prisma.processExecution.findUniqueOrThrow({ where: { id: executionId } });
    expect(row.status).toBe('VOIDED');
    expect(row.voidReason).toBe('Ejecución duplicada por error');
  }, 5_000);

  it('returns 400 without a reason', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution();

    const response = await request(app)
      .post(`/process-executions/${executionId}/void`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({});

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for a reason of 501 characters or only spaces', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution();

    const spacesRes = await request(app)
      .post(`/process-executions/${executionId}/void`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({ reason: '   ' });
    expect(spacesRes.status).toBe(400);

    const longRes = await request(app)
      .post(`/process-executions/${executionId}/void`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({ reason: 'A'.repeat(501) });
    expect(longRes.status).toBe(400);
  }, 5_000);

  it('rejects unknown body fields with 400', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution();

    const response = await request(app)
      .post(`/process-executions/${executionId}/void`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({ reason: 'Motivo', extra: true });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app)
      .post('/process-executions/exec-1/void')
      .send({ reason: 'Motivo' });

    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without ejecucion.anular', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const executionId = await seedExecution();

    const response = await request(app)
      .post(`/process-executions/${executionId}/void`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ reason: 'Motivo' });

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 404 for an unknown execution', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await request(app)
      .post('/process-executions/missing-exec/void')
      .set('Authorization', `Bearer ${president.token}`)
      .send({ reason: 'Motivo' });

    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 409 and keeps the original reason when voiding twice', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({
      status: 'VOIDED',
      voidReason: 'Motivo original',
    });

    const response = await request(app)
      .post(`/process-executions/${executionId}/void`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({ reason: 'Segundo motivo' });

    expect(response.status).toBe(409);

    const row = await prisma.processExecution.findUniqueOrThrow({ where: { id: executionId } });
    expect(row.voidReason).toBe('Motivo original');
  }, 5_000);

  it('returns 409 for a closed execution', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({ status: 'CLOSED' });

    const response = await request(app)
      .post(`/process-executions/${executionId}/void`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({ reason: 'Motivo' });

    expect(response.status).toBe(409);
  }, 5_000);

  it('writes one audit row with the reason', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({ status: 'PLANNED' });

    const response = await request(app)
      .post(`/process-executions/${executionId}/void`)
      .set('Authorization', `Bearer ${president.token}`)
      .send({ reason: 'Cancelada por duplicidad' });

    expect(response.status).toBe(200);

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'ProcessExecution', entityId: executionId, action: 'STATE_CHANGE' },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.before).toMatchObject({ status: 'PLANNED' });
    expect(audits[0]?.after).toMatchObject({
      status: 'VOIDED',
      voidReason: 'Cancelada por duplicidad',
    });
  }, 5_000);

  it('lets exactly one of a concurrent close and void win', async () => {
    const president = await createActor(['COMMITTEE_PRESIDENT']);
    const executionId = await seedExecution({
      status: 'PENDING_APPROVAL',
      withApprovedResolution: true,
    });

    const [closeRes, voidRes] = await Promise.all([
      request(app)
        .post(`/process-executions/${executionId}/close`)
        .set('Authorization', `Bearer ${president.token}`)
        .send({}),
      request(app)
        .post(`/process-executions/${executionId}/void`)
        .set('Authorization', `Bearer ${president.token}`)
        .send({ reason: 'Cancelada en paralelo' }),
    ]);

    const statuses = [closeRes.status, voidRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'ProcessExecution', entityId: executionId, action: 'STATE_CHANGE' },
    });
    expect(audits).toHaveLength(1);
  }, 5_000);
});
