import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { stakeholderListMemberDtoSchema } from '@sigoa/shared';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createStakeholderListRow } from '../../../../test/factories/stakeholder-lists.js';
import { createStakeholderRow } from '../../../../test/factories/stakeholders.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';

describe('POST /stakeholder-lists/:id/members (PostgreSQL real, HU-022, T-022-25, CA1, CA2, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholder-lists-members',
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

  const addMemberPost = (listId: string, token: string) =>
    request(app)
      .post(`/stakeholder-lists/${listId}/members`)
      .set('Authorization', `Bearer ${token}`);

  it('adds an employer institution with the Annex 3 fields (CA1)', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'EMPLOYER', year: 2027 });
    const stakeholderId = await createStakeholderRow(prisma, {
      kind: 'INSTITUTION',
      fullName: 'Tech Amazonas SAC',
      ruc: '20123456789',
      sector: 'Tecnologia',
      position: 'Gerente General',
      email: 'contacto@techamazonas.example.test',
      mobile: '987654321',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await addMemberPost(listId, member.token).send({
      stakeholderId,
      representative: '  Carlos Mendoza  ',
    });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = stakeholderListMemberDtoSchema.parse(response.body);
    expect(dto.listId).toBe(listId);
    expect(dto.stakeholderId).toBe(stakeholderId);
    expect(dto.institution).toBe('Tech Amazonas SAC');
    expect(dto.ruc).toBe('20123456789');
    expect(dto.sector).toBe('Tecnologia');
    expect(dto.representative).toBe('Carlos Mendoza');
    expect(dto.email).toBe('contacto@techamazonas.example.test');
    expect(dto.mobile).toBe('987654321');
    expect(dto.position).toBe('Gerente General');
  }, 5_000);

  it('adds a graduate with graduation year, email and mobile (CA2)', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'GRADUATE', year: 2027 });
    const stakeholderId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Ana Torres',
      graduationYear: 2022,
      email: 'ana@example.test',
      mobile: '987654322',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await addMemberPost(listId, member.token).send({ stakeholderId });

    expect(response.status).toBe(201);
    const dto = stakeholderListMemberDtoSchema.parse(response.body);
    expect(dto.graduationYear).toBe(2022);
    expect(dto.email).toBe('ana@example.test');
    expect(dto.mobile).toBe('987654322');
  }, 5_000);

  it('returns 400 with the missing fields for a graduate without graduation year (CA2)', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'GRADUATE', year: 2027 });
    const stakeholderId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Ana Torres',
      graduationYear: null,
      email: null,
      mobile: '987654322',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await addMemberPost(listId, member.token).send({ stakeholderId });

    expect(response.status).toBe(400);
    expect(response.body.error.details.map((d: { path: string }) => d.path)).toEqual([
      'año de egreso',
      'correo',
    ]);
  }, 5_000);

  it('returns 400 when a person is added to an employers list', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'EMPLOYER', year: 2027 });
    const personId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Juan Perez',
      email: 'juan@example.test',
      mobile: '987654323',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await addMemberPost(listId, member.token).send({
      stakeholderId: personId,
      representative: 'Juan Perez',
    });

    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 404 for an unknown list or stakeholder', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const teacherId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      email: 'docente@example.test',
      mobile: '987654324',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const unknownList = await addMemberPost('missing-list', member.token).send({
      stakeholderId: teacherId,
    });
    expect(unknownList.status).toBe(404);

    const unknownStakeholder = await addMemberPost(listId, member.token).send({
      stakeholderId: 'missing-stakeholder',
    });
    expect(unknownStakeholder.status).toBe(404);
  }, 5_000);

  it('returns 409 for a voided stakeholder', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const voidedId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      status: 'VOIDED',
      email: 'voided@example.test',
      mobile: '987654325',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await addMemberPost(listId, member.token).send({
      stakeholderId: voidedId,
    });

    expect(response.status).toBe(409);
  }, 5_000);

  it('returns 409 for a stakeholder already in the list', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const teacherId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      email: 'docente@example.test',
      mobile: '987654326',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const first = await addMemberPost(listId, member.token).send({ stakeholderId: teacherId });
    expect(first.status).toBe(201);

    const duplicate = await addMemberPost(listId, member.token).send({
      stakeholderId: teacherId,
    });
    expect(duplicate.status).toBe(409);
  }, 5_000);

  it('lets exactly one of two simultaneous adds of the same stakeholder win', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const teacherId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      email: 'concurrente@example.test',
      mobile: '987654327',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const [first, second] = await Promise.all([
      addMemberPost(listId, member.token).send({ stakeholderId: teacherId }),
      addMemberPost(listId, member.token).send({ stakeholderId: teacherId }),
    ]);

    expect([first.status, second.status].sort((a, b) => a - b)).toEqual([201, 409]);

    const count = await prisma.stakeholderListMember.count({
      where: { listId, stakeholderId: teacherId },
    });
    expect(count).toBe(1);
  }, 5_000);

  it('writes the audit row without email or mobile', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const teacherId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      email: 'secreto@example.test',
      mobile: '987654328',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await addMemberPost(listId, member.token).send({
      stakeholderId: teacherId,
    });
    expect(response.status).toBe(201);

    const auditRow = await prisma.auditLog.findFirst({
      where: {
        entity: 'StakeholderListMember',
        entityId: response.body.id,
        action: 'CREATE',
      },
    });
    expect(auditRow).not.toBeNull();
    const after = auditRow?.after as Record<string, unknown>;
    expect(after.hasEmail).toBe(true);
    expect(after.hasMobile).toBe(true);
    expect('email' in after).toBe(false);
    expect('mobile' in after).toBe(false);
  }, 5_000);

  it('returns 400 for a representative over 150 characters or an id over 64', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'EMPLOYER', year: 2027 });
    const stakeholderId = await createStakeholderRow(prisma, { kind: 'INSTITUTION' });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const longRep = await addMemberPost(listId, member.token).send({
      stakeholderId,
      representative: 'a'.repeat(151),
    });
    expect(longRep.status).toBe(400);

    const longId = await addMemberPost('x'.repeat(65), member.token).send({
      stakeholderId,
    });
    expect(longId.status).toBe(400);
  }, 5_000);

  it('returns 403 without constituyente.editar', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const teacher = await createActor(['TEACHER']);

    const response = await addMemberPost(listId, teacher.token).send({
      stakeholderId: 'stk-1',
    });

    expect(response.status).toBe(403);
  }, 5_000);
});
