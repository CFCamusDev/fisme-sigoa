import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { listStakeholderListsResponseSchema } from '@sigoa/shared';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import {
  createStakeholderListMemberRow,
  createStakeholderListRow,
  ensureTestProgramRow,
} from '../../../../test/factories/stakeholder-lists.js';
import { createStakeholderRow } from '../../../../test/factories/stakeholders.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';

describe('GET /stakeholder-lists (PostgreSQL real, HU-022, T-022-27, RF-022, RNF-009, RNF-012)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholder-lists-get',
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

  const listGet = (token: string) =>
    request(app).get('/stakeholder-lists').set('Authorization', `Bearer ${token}`);

  it('lists the lists with member counts', async () => {
    const programId = await ensureTestProgramRow(prisma);
    const list2026Id = await createStakeholderListRow(prisma, {
      programId,
      type: 'EMPLOYER',
      year: 2026,
    });
    const list2027Id = await createStakeholderListRow(prisma, {
      programId,
      type: 'TEACHER',
      year: 2027,
    });
    const teacherId = await createStakeholderRow(prisma, { kind: 'PERSON' });
    await createStakeholderListMemberRow(prisma, {
      listId: list2027Id,
      stakeholderId: teacherId,
      fullName: 'Docente Uno',
      email: 'docente@example.test',
      mobile: '987654321',
    });

    const viewer = await createActor(['TEACHER']);
    const response = await listGet(viewer.token);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = listStakeholderListsResponseSchema.parse(response.body);
    expect(dto.total).toBe(2);
    expect(dto.items[0]?.id).toBe(list2027Id);
    expect(dto.items[0]?.memberCount).toBe(1);
    expect(dto.items[0]?.members).toBeNull();
    expect(dto.items[1]?.id).toBe(list2026Id);
    expect(dto.items[1]?.memberCount).toBe(0);
  }, 5_000);

  it('filters by type and year and returns members only when asked', async () => {
    const programId = await ensureTestProgramRow(prisma);
    const listId = await createStakeholderListRow(prisma, {
      programId,
      type: 'TEACHER',
      year: 2027,
    });
    await createStakeholderListRow(prisma, {
      programId,
      type: 'EMPLOYER',
      year: 2027,
    });
    const teacherId = await createStakeholderRow(prisma, { kind: 'PERSON' });
    await createStakeholderListMemberRow(prisma, {
      listId,
      stakeholderId: teacherId,
      fullName: 'Docente Uno',
      email: 'docente@example.test',
      mobile: '987654321',
    });

    const viewer = await createActor(['TEACHER']);
    const response = await listGet(viewer.token).query({
      type: 'TEACHER',
      year: 2027,
      includeMembers: 'true',
    });

    expect(response.status).toBe(200);
    const dto = listStakeholderListsResponseSchema.parse(response.body);
    expect(dto.total).toBe(1);
    expect(dto.items[0]?.members).toHaveLength(1);
    expect(dto.items[0]?.members?.[0]?.fullName).toBe('Docente Uno');
  }, 5_000);

  it('returns members with null optional fields', async () => {
    const listId = await createStakeholderListRow(prisma, {
      type: 'TEACHER',
      year: 2027,
    });
    const teacherId = await createStakeholderRow(prisma, { kind: 'PERSON' });
    await createStakeholderListMemberRow(prisma, {
      listId,
      stakeholderId: teacherId,
      fullName: 'Docente Minimo',
      email: null,
      mobile: null,
      institution: null,
    });

    const viewer = await createActor(['TEACHER']);
    const response = await listGet(viewer.token).query({
      type: 'TEACHER',
      year: 2027,
      includeMembers: 'true',
    });

    expect(response.status).toBe(200);
    const dto = listStakeholderListsResponseSchema.parse(response.body);
    expect(dto.items[0]?.members?.[0]?.email).toBeNull();
    expect(dto.items[0]?.members?.[0]?.mobile).toBeNull();
  }, 5_000);

  it('returns an empty page', async () => {
    const viewer = await createActor(['TEACHER']);
    const response = await listGet(viewer.token).query({
      type: 'ADVISORY_BOARD',
      year: 2030,
    });

    expect(response.status).toBe(200);
    const dto = listStakeholderListsResponseSchema.parse(response.body);
    expect(dto.items).toEqual([]);
    expect(dto.total).toBe(0);
    expect(dto.totalPages).toBe(0);
  }, 5_000);

  it('returns 400 when includeMembers lacks type and year', async () => {
    const viewer = await createActor(['TEACHER']);
    const response = await listGet(viewer.token).query({
      includeMembers: 'true',
      type: 'TEACHER',
    });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for pageSize over 100, page over 10000 or an unknown query parameter', async () => {
    const viewer = await createActor(['TEACHER']);

    expect((await listGet(viewer.token).query({ pageSize: 101 })).status).toBe(400);
    expect((await listGet(viewer.token).query({ page: 10001 })).status).toBe(400);
    expect((await listGet(viewer.token).query({ extra: '1' })).status).toBe(400);
  }, 5_000);

  it('returns 403 without constituyente.ver', async () => {
    const student = await createActor(['STUDENT']);
    const response = await listGet(student.token);

    expect(response.status).toBe(403);
  }, 5_000);
});
