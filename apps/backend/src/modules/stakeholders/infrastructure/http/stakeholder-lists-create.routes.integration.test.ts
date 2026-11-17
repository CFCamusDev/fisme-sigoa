import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { stakeholderListDtoSchema } from '@sigoa/shared';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import {
  createStakeholderListRow,
  ensureTestProgramRow,
} from '../../../../test/factories/stakeholder-lists.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';

describe('POST /stakeholder-lists (PostgreSQL real, HU-022, T-022-24, RF-022, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholder-lists-create',
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

  const createListPost = (token: string) =>
    request(app).post('/stakeholder-lists').set('Authorization', `Bearer ${token}`);

  it('creates a list for a type and year and audits it', async () => {
    const programId = await ensureTestProgramRow(prisma);
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await createListPost(member.token).send({
      type: 'EMPLOYER',
      year: 2027,
      studyPlanNumber: ' 2024-II ',
      version: ' v1.0 ',
    });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = stakeholderListDtoSchema.parse(response.body);
    expect(dto.programId).toBe(programId);
    expect(dto.type).toBe('EMPLOYER');
    expect(dto.year).toBe(2027);
    expect(dto.studyPlanNumber).toBe('2024-II');
    expect(dto.version).toBe('v1.0');
    expect(dto.memberCount).toBe(0);
    expect(dto.members).toBeNull();

    const auditRow = await prisma.auditLog.findFirst({
      where: { entity: 'StakeholderList', entityId: dto.id, action: 'CREATE' },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow?.actor).toBe(member.user.id);
  }, 5_000);

  it('accepts a list without study plan number and version', async () => {
    await ensureTestProgramRow(prisma);
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await createListPost(member.token).send({
      type: 'GRADUATE',
      year: 2027,
    });

    expect(response.status).toBe(201);
    const dto = stakeholderListDtoSchema.parse(response.body);
    expect(dto.studyPlanNumber).toBeNull();
    expect(dto.version).toBeNull();
  }, 5_000);

  it('returns 409 for a duplicate type and year', async () => {
    await createStakeholderListRow(prisma, { type: 'EMPLOYER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await createListPost(member.token).send({
      type: 'EMPLOYER',
      year: 2027,
    });

    expect(response.status).toBe(409);
  }, 5_000);

  it('lets exactly one of two simultaneous creations of the same type and year win', async () => {
    await ensureTestProgramRow(prisma);
    const member = await createActor(['COMMITTEE_MEMBER']);

    const [first, second] = await Promise.all([
      createListPost(member.token).send({ type: 'TEACHER', year: 2027 }),
      createListPost(member.token).send({ type: 'TEACHER', year: 2027 }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const count = await prisma.stakeholderList.count({
      where: { type: 'TEACHER', year: 2027 },
    });
    expect(count).toBe(1);
  }, 5_000);

  it('returns 400 for a year out of range, an unknown field or an invalid type', async () => {
    await ensureTestProgramRow(prisma);
    const member = await createActor(['COMMITTEE_MEMBER']);

    const outOfRange = await createListPost(member.token).send({
      type: 'EMPLOYER',
      year: 1999,
    });
    expect(outOfRange.status).toBe(400);

    const unknownField = await createListPost(member.token).send({
      type: 'EMPLOYER',
      year: 2027,
      extra: true,
    });
    expect(unknownField.status).toBe(400);

    const invalidType = await createListPost(member.token).send({
      type: 'UNKNOWN',
      year: 2027,
    });
    expect(invalidType.status).toBe(400);
  }, 5_000);

  it('returns 403 without constituyente.editar', async () => {
    const teacher = await createActor(['TEACHER']);

    const response = await createListPost(teacher.token).send({
      type: 'EMPLOYER',
      year: 2027,
    });

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app).post('/stakeholder-lists').send({
      type: 'EMPLOYER',
      year: 2027,
    });

    expect(response.status).toBe(401);
  }, 5_000);
});
