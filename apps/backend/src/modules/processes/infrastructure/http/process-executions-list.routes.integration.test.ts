import { listProcessExecutionsResponseSchema } from '@sigoa/shared';
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

describe('GET /process-executions (PostgreSQL real, HU-027, T-027-20, RF-027, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-process-executions-list',
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

  const getExecutions = (token: string, query = '') =>
    request(app).get(`/process-executions${query}`).set('Authorization', `Bearer ${token}`);

  async function seedExecutions() {
    const program = await prisma.program.create({
      data: {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
    const cvApproved = await prisma.catalogVersion.create({
      data: { id: 'cv-app', programId: program.id, number: 1, status: 'APPROVED' },
    });
    const cvValidation = await prisma.catalogVersion.create({
      data: { id: 'cv-val', programId: program.id, number: 2, status: 'IN_VALIDATION' },
    });
    const semester = await prisma.semester.create({
      data: {
        id: 'sem-2027-1',
        code: '2027-I',
        startDate: new Date('2027-03-01T00:00:00.000Z'),
        endDate: new Date('2027-07-15T00:00:00.000Z'),
      },
    });

    await prisma.processExecution.createMany({
      data: [
        {
          id: 'exec-1',
          programId: program.id,
          type: 'P612',
          name: 'Medición anual de OE 2026',
          year: 2026,
          semesterId: null,
          catalogVersionId: cvApproved.id,
          status: 'CLOSED',
          createdBy: 'user-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'exec-2',
          programId: program.id,
          type: 'P622',
          name: 'Medición directa de AG 2027-I',
          year: 2027,
          semesterId: semester.id,
          catalogVersionId: cvApproved.id,
          status: 'PLANNED',
          createdBy: 'user-1',
          createdAt: new Date('2027-01-01T00:00:00.000Z'),
        },
        {
          id: 'exec-3',
          programId: program.id,
          type: 'P611',
          name: 'Establecimiento y validación de OE 2027',
          year: 2027,
          semesterId: null,
          catalogVersionId: cvValidation.id,
          status: 'PLANNED',
          createdBy: 'user-1',
          createdAt: new Date('2027-02-01T00:00:00.000Z'),
        },
      ],
    });
  }

  it('lists the executions newest first with semester and version', async () => {
    await seedExecutions();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await getExecutions(member.token);

    expect(response.status).toBe(200);
    const body = listProcessExecutionsResponseSchema.parse(response.body);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.items.map((item) => item.id)).toEqual(['exec-3', 'exec-2', 'exec-1']);
    expect(body.items[0]?.catalogVersionNumber).toBe(2);
    expect(body.items[0]?.semesterCode).toBeNull();
    expect(body.items[1]?.semesterCode).toBe('2027-I');
    expect(body.items[1]?.catalogVersionNumber).toBe(1);
  }, 5_000);

  it('filters by type, year and status', async () => {
    await seedExecutions();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await getExecutions(member.token, '?type=P622&year=2027&status=PLANNED');

    expect(response.status).toBe(200);
    const body = listProcessExecutionsResponseSchema.parse(response.body);
    expect(body.total).toBe(1);
    expect(body.items[0]?.id).toBe('exec-2');
  }, 5_000);

  it('paginates with page and pageSize', async () => {
    await seedExecutions();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await getExecutions(member.token, '?page=2&pageSize=2');

    expect(response.status).toBe(200);
    const body = listProcessExecutionsResponseSchema.parse(response.body);
    expect(body.total).toBe(3);
    expect(body.totalPages).toBe(2);
    expect(body.items.map((item) => item.id)).toEqual(['exec-1']);
  }, 5_000);

  it('returns an empty page', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await getExecutions(member.token);

    expect(response.status).toBe(200);
    const body = listProcessExecutionsResponseSchema.parse(response.body);
    expect(body).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
  }, 5_000);

  it('returns 400 for pageSize over 100', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await getExecutions(member.token, '?pageSize=101');
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for page 0', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await getExecutions(member.token, '?page=0');
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for an unknown filter or enum value', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    expect((await getExecutions(member.token, '?unknown=1')).status).toBe(400);
    expect((await getExecutions(member.token, '?type=P999')).status).toBe(400);
    expect((await getExecutions(member.token, '?status=INVALID')).status).toBe(400);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app).get('/process-executions');
    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without ejecucion.ver', async () => {
    const teacher = await createActor(['TEACHER']);
    const response = await getExecutions(teacher.token);
    expect(response.status).toBe(403);
  }, 5_000);
});
