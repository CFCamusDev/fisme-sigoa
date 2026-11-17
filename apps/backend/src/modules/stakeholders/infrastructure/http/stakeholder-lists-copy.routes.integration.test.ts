import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { copyStakeholderListResponseSchema } from '@sigoa/shared';
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

describe('POST /stakeholder-lists/:id/copy (PostgreSQL real, HU-022, T-022-26, CA3, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholder-lists-copy',
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

  const copyPost = (listId: string, token: string) =>
    request(app).post(`/stakeholder-lists/${listId}/copy`).set('Authorization', `Bearer ${token}`);

  it('creates the new year list with the same members (CA3)', async () => {
    const sourceListId = await createStakeholderListRow(prisma, {
      type: 'EMPLOYER',
      year: 2026,
    });
    const employerId = await createStakeholderRow(prisma, {
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
      sector: 'Software',
      position: 'Director',
      email: 'contacto@techamazonas.example.test',
      mobile: '987654321',
    });
    await createStakeholderListMemberRow(prisma, {
      listId: sourceListId,
      stakeholderId: employerId,
      fullName: 'Tech Amazonas SAC',
      institution: 'Tech Amazonas SAC',
      ruc: '20123456789',
      sector: 'Tecnologia',
      representative: 'Carlos Mendoza',
      position: 'Gerente',
      email: 'viejo@techamazonas.example.test',
      mobile: '987654321',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await copyPost(sourceListId, member.token).send({ year: 2027 });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = copyStakeholderListResponseSchema.parse(response.body);
    expect(dto.list.year).toBe(2027);
    expect(dto.list.memberCount).toBe(1);
    expect(dto.list.members).toHaveLength(1);
    expect(dto.list.members?.[0]?.representative).toBe('Carlos Mendoza');
    expect(dto.list.members?.[0]?.sector).toBe('Software');
    expect(dto.skipped).toEqual([]);
  }, 5_000);

  it('copies the study plan number and version', async () => {
    const sourceListId = await createStakeholderListRow(prisma, {
      type: 'TEACHER',
      year: 2026,
      studyPlanNumber: '2024-II',
      version: 'v2.0',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await copyPost(sourceListId, member.token).send({ year: 2027 });

    expect(response.status).toBe(201);
    const dto = copyStakeholderListResponseSchema.parse(response.body);
    expect(dto.list.studyPlanNumber).toBe('2024-II');
    expect(dto.list.version).toBe('v2.0');
  }, 5_000);

  it('reports voided stakeholders as skipped', async () => {
    const sourceListId = await createStakeholderListRow(prisma, {
      type: 'TEACHER',
      year: 2026,
    });
    const activeId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Docente Activo',
      email: 'activo@example.test',
      mobile: '987654321',
    });
    const voidedId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Docente Anulado',
      status: 'VOIDED',
      email: 'anulado@example.test',
      mobile: '987654322',
    });
    await createStakeholderListMemberRow(prisma, {
      listId: sourceListId,
      stakeholderId: activeId,
      fullName: 'Docente Activo',
      email: 'activo@example.test',
      mobile: '987654321',
    });
    await createStakeholderListMemberRow(prisma, {
      listId: sourceListId,
      stakeholderId: voidedId,
      fullName: 'Docente Anulado',
      email: 'anulado@example.test',
      mobile: '987654322',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await copyPost(sourceListId, member.token).send({ year: 2027 });

    expect(response.status).toBe(201);
    const dto = copyStakeholderListResponseSchema.parse(response.body);
    expect(dto.list.memberCount).toBe(1);
    expect(dto.skipped).toEqual([
      {
        stakeholderId: voidedId,
        fullName: 'Docente Anulado',
        reason: 'VOIDED',
      },
    ]);
  }, 5_000);

  it('returns 409 when the target year already has a list', async () => {
    const programId = await ensureTestProgramRow(prisma);
    const sourceListId = await createStakeholderListRow(prisma, {
      programId,
      type: 'TEACHER',
      year: 2026,
    });
    await createStakeholderListRow(prisma, {
      programId,
      type: 'TEACHER',
      year: 2027,
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await copyPost(sourceListId, member.token).send({ year: 2027 });
    expect(response.status).toBe(409);
  }, 5_000);

  it('lets exactly one of two simultaneous copies to the same year win and leaves one list', async () => {
    const sourceListId = await createStakeholderListRow(prisma, {
      type: 'TEACHER',
      year: 2026,
    });
    const teacherId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Docente Uno',
      email: 'docente@example.test',
      mobile: '987654321',
    });
    await createStakeholderListMemberRow(prisma, {
      listId: sourceListId,
      stakeholderId: teacherId,
      fullName: 'Docente Uno',
      email: 'docente@example.test',
      mobile: '987654321',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const [first, second] = await Promise.all([
      copyPost(sourceListId, member.token).send({ year: 2027 }),
      copyPost(sourceListId, member.token).send({ year: 2027 }),
    ]);

    expect([first.status, second.status].sort((a, b) => a - b)).toEqual([201, 409]);

    const count = await prisma.stakeholderList.count({
      where: { type: 'TEACHER', year: 2027 },
    });
    expect(count).toBe(1);
  }, 5_000);

  it('returns 400 when the target year is not after the source year', async () => {
    const sourceListId = await createStakeholderListRow(prisma, {
      type: 'TEACHER',
      year: 2026,
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await copyPost(sourceListId, member.token).send({ year: 2026 });
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for an unknown field or a year out of range', async () => {
    const sourceListId = await createStakeholderListRow(prisma, {
      type: 'TEACHER',
      year: 2026,
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const unknownField = await copyPost(sourceListId, member.token).send({
      year: 2027,
      extra: true,
    });
    expect(unknownField.status).toBe(400);

    const outOfRange = await copyPost(sourceListId, member.token).send({ year: 2101 });
    expect(outOfRange.status).toBe(400);
  }, 5_000);

  it('returns 404 for an unknown list', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await copyPost('missing-list', member.token).send({ year: 2027 });
    expect(response.status).toBe(404);
  }, 5_000);

  it('does not leave a partial list when the copy fails', async () => {
    const programId = await ensureTestProgramRow(prisma);
    const sourceListId = await createStakeholderListRow(prisma, {
      programId,
      type: 'GRADUATE',
      year: 2026,
    });
    const graduateId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Graduado Uno',
      graduationYear: 2022,
      email: 'grad@example.test',
      mobile: '987654321',
    });
    await createStakeholderListMemberRow(prisma, {
      listId: sourceListId,
      stakeholderId: graduateId,
      fullName: 'Graduado Uno',
      graduationYear: 2022,
      email: 'grad@example.test',
      mobile: '987654321',
    });
    await createStakeholderListRow(prisma, {
      programId,
      type: 'GRADUATE',
      year: 2027,
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await copyPost(sourceListId, member.token).send({ year: 2027 });
    expect(response.status).toBe(409);

    const targetMembersCount = await prisma.stakeholderListMember.count({
      where: { list: { programId, type: 'GRADUATE', year: 2027 } },
    });
    expect(targetMembersCount).toBe(0);
  }, 5_000);

  it('returns 403 without constituyente.editar', async () => {
    const sourceListId = await createStakeholderListRow(prisma, {
      type: 'TEACHER',
      year: 2026,
    });
    const teacher = await createActor(['TEACHER']);

    const response = await copyPost(sourceListId, teacher.token).send({ year: 2027 });
    expect(response.status).toBe(403);
  }, 5_000);
});
