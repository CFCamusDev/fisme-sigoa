import { processExecutionDtoSchema } from '@sigoa/shared';
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

describe('POST /process-executions (PostgreSQL real, HU-027, T-027-19, RF-027, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-process-executions-create',
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

  const postExecution = (token: string) =>
    request(app).post('/process-executions').set('Authorization', `Bearer ${token}`);

  async function seedProgramAndVersions() {
    const program = await prisma.program.create({
      data: {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
    const approvedVersion = await prisma.catalogVersion.create({
      data: {
        id: 'cv-approved',
        programId: program.id,
        number: 1,
        status: 'APPROVED',
      },
    });
    const validationVersion = await prisma.catalogVersion.create({
      data: {
        id: 'cv-validation',
        programId: program.id,
        number: 2,
        status: 'IN_VALIDATION',
      },
    });
    return { program, approvedVersion, validationVersion };
  }

  it('creates the annual OE measurement 2027 as PLANNED', async () => {
    const { approvedVersion } = await seedProgramAndVersions();
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await postExecution(president.token).send({
      type: 'P612',
      year: 2027,
      catalogVersionId: approvedVersion.id,
    });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = processExecutionDtoSchema.parse(response.body);
    expect(dto.type).toBe('P612');
    expect(dto.name).toBe('Medición anual de OE 2027');
    expect(dto.year).toBe(2027);
    expect(dto.status).toBe('PLANNED');
    expect(dto.semesterId).toBeNull();
    expect(dto.semesterCode).toBeNull();
    expect(dto.catalogVersionId).toBe(approvedVersion.id);
    expect(dto.catalogVersionNumber).toBe(1);

    const row = await prisma.processExecution.findUnique({ where: { id: dto.id } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe('PLANNED');

    const auditRow = await prisma.auditLog.findFirst({
      where: { entity: 'ProcessExecution', entityId: dto.id, action: 'CREATE' },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actor).toBe(president.user.id);
  }, 5_000);

  it('creates with only type, year and catalog version', async () => {
    const { validationVersion } = await seedProgramAndVersions();
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await postExecution(member.token).send({
      type: 'P611',
      year: 2027,
      catalogVersionId: validationVersion.id,
    });

    expect(response.status).toBe(201);
    const dto = processExecutionDtoSchema.parse(response.body);
    expect(dto.name).toBe('Establecimiento y validación de OE 2027');
    expect(dto.semesterId).toBeNull();
  }, 5_000);

  it('returns 409 when the version does not match the process type', async () => {
    const { approvedVersion } = await seedProgramAndVersions();
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await postExecution(president.token).send({
      type: 'P611',
      year: 2027,
      catalogVersionId: approvedVersion.id,
    });

    expect(response.status).toBe(409);
  }, 5_000);

  it('returns 409 for a duplicate name and leaves no audit record', async () => {
    const { approvedVersion } = await seedProgramAndVersions();
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const first = await postExecution(president.token).send({
      type: 'P612',
      year: 2027,
      catalogVersionId: approvedVersion.id,
    });
    expect(first.status).toBe(201);

    const duplicate = await postExecution(president.token).send({
      type: 'P612',
      year: 2027,
      catalogVersionId: approvedVersion.id,
    });
    expect(duplicate.status).toBe(409);

    const auditCount = await prisma.auditLog.count({
      where: { entity: 'ProcessExecution', action: 'CREATE' },
    });
    expect(auditCount).toBe(1);
  }, 5_000);

  it('lets exactly one of two concurrent identical requests win', async () => {
    const { approvedVersion } = await seedProgramAndVersions();
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const payload = {
      type: 'P612',
      year: 2027,
      catalogVersionId: approvedVersion.id,
    };

    const [r1, r2] = await Promise.all([
      postExecution(president.token).send(payload),
      postExecution(president.token).send(payload),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const rows = await prisma.processExecution.count();
    expect(rows).toBe(1);

    const audits = await prisma.auditLog.count({
      where: { entity: 'ProcessExecution', action: 'CREATE' },
    });
    expect(audits).toBe(1);
  }, 5_000);

  it('returns 400 for an unknown field', async () => {
    const { approvedVersion } = await seedProgramAndVersions();
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await postExecution(president.token).send({
      type: 'P612',
      year: 2027,
      catalogVersionId: approvedVersion.id,
      unexpected: 'nope',
    });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for a name over 150 characters', async () => {
    const { approvedVersion } = await seedProgramAndVersions();
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await postExecution(president.token).send({
      type: 'P612',
      year: 2027,
      catalogVersionId: approvedVersion.id,
      name: 'N'.repeat(151),
    });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for a year out of range', async () => {
    const { approvedVersion } = await seedProgramAndVersions();
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await postExecution(president.token).send({
      type: 'P612',
      year: 1999,
      catalogVersionId: approvedVersion.id,
    });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for P622 without a semester', async () => {
    const { approvedVersion } = await seedProgramAndVersions();
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await postExecution(president.token).send({
      type: 'P622',
      year: 2027,
      catalogVersionId: approvedVersion.id,
    });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 404 for an unknown catalog version', async () => {
    await seedProgramAndVersions();
    const president = await createActor(['COMMITTEE_PRESIDENT']);

    const response = await postExecution(president.token).send({
      type: 'P612',
      year: 2027,
      catalogVersionId: 'non-existent-cv',
    });

    expect(response.status).toBe(404);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app).post('/process-executions').send({
      type: 'P612',
      year: 2027,
      catalogVersionId: 'cv-approved',
    });

    expect(response.status).toBe(401);
  }, 5_000);

  it('returns 403 without ejecucion.crear', async () => {
    const { approvedVersion } = await seedProgramAndVersions();
    const teacher = await createActor(['TEACHER']);

    const response = await postExecution(teacher.token).send({
      type: 'P612',
      year: 2027,
      catalogVersionId: approvedVersion.id,
    });

    expect(response.status).toBe(403);
  }, 5_000);
});
