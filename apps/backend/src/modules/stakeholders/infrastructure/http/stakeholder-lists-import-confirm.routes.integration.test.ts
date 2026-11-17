import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  STAKEHOLDER_IMPORT_MAX_FILE_BYTES,
  STAKEHOLDER_IMPORT_XLSX_MIME,
  confirmStakeholderImportResponseSchema,
} from '@sigoa/shared';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createStakeholderListRow } from '../../../../test/factories/stakeholder-lists.js';
import { createStakeholderRow } from '../../../../test/factories/stakeholders.js';
import { buildWorkbookBuffer } from '../../../../test/factories/xlsx-workbook.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { getStakeholderImportColumns } from '../../domain/policies/stakeholder-import-columns.js';

describe('POST /stakeholder-lists/:id/import/confirm (PostgreSQL real, HU-023, T-023-16, CA2, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholder-import-confirm',
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

  const postConfirm = (listId: string, token: string, mime = STAKEHOLDER_IMPORT_XLSX_MIME) =>
    request(app)
      .post(`/stakeholder-lists/${listId}/import/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', mime);

  it('creates new stakeholders and members and returns the totals', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['71234567', 'Mario Quispe Salas', 'mario.quispe@example.test', '912345678'],
      ['71234568', 'Lucia Torres Vega', 'lucia.torres@example.test', '912345679'],
    ]);

    const response = await postConfirm(listId, member.token).send(buffer);

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = confirmStakeholderImportResponseSchema.parse(response.body);
    expect(dto.listId).toBe(listId);
    expect(dto.totals).toEqual({
      created: 2,
      reused: 0,
      added: 2,
      alreadyInList: 0,
      rejected: 0,
    });
    expect(dto.rejectedRows).toEqual([]);

    expect(await prisma.stakeholder.count()).toBe(2);
    expect(await prisma.stakeholderListMember.count({ where: { listId } })).toBe(2);
  }, 5_000);

  it('reuses existing stakeholders without duplicating them', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'EMPLOYER', year: 2027 });
    const existingId = await createStakeholderRow(prisma, {
      kind: 'INSTITUTION',
      fullName: 'Andes Tech SAC',
      ruc: '20123456789',
      sector: 'Tecnologia',
      position: 'Gerente General',
      email: 'contacto@andestech.example.test',
      mobile: '987654321',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const headers = getStakeholderImportColumns('EMPLOYER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      [
        '20123456789',
        'Nombre Ignorado',
        'Otro Sector',
        'Carlos Mendoza',
        'otro@example.test',
        '911111111',
        'Otro Cargo',
      ],
    ]);

    const response = await postConfirm(listId, member.token).send(buffer);

    expect(response.status).toBe(201);
    const dto = confirmStakeholderImportResponseSchema.parse(response.body);
    expect(dto.totals).toEqual({
      created: 0,
      reused: 1,
      added: 1,
      alreadyInList: 0,
      rejected: 0,
    });

    expect(await prisma.stakeholder.count({ where: { ruc: '20123456789' } })).toBe(1);
    const master = await prisma.stakeholder.findUnique({ where: { id: existingId } });
    expect(master?.fullName).toBe('Andes Tech SAC');
    const createdMember = await prisma.stakeholderListMember.findFirst({
      where: { listId, stakeholderId: existingId },
    });
    expect(createdMember?.representative).toBe('Carlos Mendoza');
  }, 5_000);

  it('skips members already in the list', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const existingId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Rosa Diaz',
      dni: '45678912',
      email: 'rosa@example.test',
      mobile: '987654321',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);
    await prisma.stakeholderListMember.create({
      data: {
        id: 'mem-already',
        listId,
        stakeholderId: existingId,
        fullName: 'Rosa Diaz',
        email: 'rosa@example.test',
        mobile: '987654321',
        createdBy: member.user.id,
      },
    });

    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['45678912', 'Rosa Diaz', 'rosa@example.test', '987654321'],
      ['71234567', 'Nuevo Docente', 'nuevo@example.test', '912345678'],
    ]);

    const response = await postConfirm(listId, member.token).send(buffer);

    expect(response.status).toBe(201);
    const dto = confirmStakeholderImportResponseSchema.parse(response.body);
    expect(dto.totals).toEqual({
      created: 1,
      reused: 0,
      added: 1,
      alreadyInList: 1,
      rejected: 0,
    });
    expect(await prisma.stakeholderListMember.count({ where: { listId } })).toBe(2);
  }, 5_000);

  it('imports valid rows and reports the rejected ones', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['71234567', 'Docente Valido', 'valido@example.test', '912345678'],
      ['71234568', '', 'sinnombre@example.test', '912345679'],
    ]);

    const response = await postConfirm(listId, member.token).send(buffer);

    expect(response.status).toBe(201);
    const dto = confirmStakeholderImportResponseSchema.parse(response.body);
    expect(dto.totals).toEqual({
      created: 1,
      reused: 0,
      added: 1,
      alreadyInList: 0,
      rejected: 1,
    });
    expect(dto.rejectedRows).toHaveLength(1);
    expect(dto.rejectedRows[0]?.rowNumber).toBe(3);
  }, 5_000);

  it('audits one summary without personal data', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['71234567', 'Mario Quispe', 'secreto.personal@example.test', '987654321'],
    ]);

    const response = await postConfirm(listId, member.token).send(buffer);
    expect(response.status).toBe(201);

    const audits = await prisma.auditLog.findMany({
      where: { entity: 'StakeholderListImport' },
    });
    expect(audits).toHaveLength(1);
    const serialized = JSON.stringify(audits[0]?.after);
    expect(serialized).not.toContain('secreto.personal@example.test');
    expect(serialized).not.toContain('987654321');
    expect(serialized).not.toContain('Mario Quispe');
  }, 5_000);

  it('returns 400 when no row is valid', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const existingId = await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Rosa Diaz',
      dni: '45678912',
      email: 'rosa@example.test',
      mobile: '987654321',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);
    await prisma.stakeholderListMember.create({
      data: {
        id: 'mem-only-existing',
        listId,
        stakeholderId: existingId,
        fullName: 'Rosa Diaz',
        email: 'rosa@example.test',
        mobile: '987654321',
        createdBy: member.user.id,
      },
    });

    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const invalidBuffer = await buildWorkbookBuffer(headers, [
      ['123', 'Invalido', 'bad@example.test', '912345678'],
    ]);
    const alreadyInListBuffer = await buildWorkbookBuffer(headers, [
      ['45678912', 'Rosa Diaz', 'rosa@example.test', '987654321'],
    ]);

    expect((await postConfirm(listId, member.token).send(invalidBuffer)).status).toBe(400);
    expect((await postConfirm(listId, member.token).send(alreadyInListBuffer)).status).toBe(400);
  }, 5_000);

  it('returns 400 for an empty body, a non-xlsx file, headers of another list type and above 500 rows', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'GRADUATE', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);

    expect((await postConfirm(listId, member.token).send(Buffer.alloc(0))).status).toBe(400);
    expect(
      (await postConfirm(listId, member.token).send(Buffer.from('not-xlsx', 'utf8'))).status,
    ).toBe(400);
    expect(
      (await postConfirm(listId, member.token, 'application/json').send({ any: true })).status,
    ).toBe(400);

    const teacherHeaders = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const mismatchBuffer = await buildWorkbookBuffer(teacherHeaders, [
      ['71234567', 'Docente', 'docente@example.test', '912345678'],
    ]);
    expect((await postConfirm(listId, member.token).send(mismatchBuffer)).status).toBe(400);

    const graduateHeaders = getStakeholderImportColumns('GRADUATE').map((col) => col.header);
    const tooManyRows = Array.from({ length: 501 }, (_, idx) => [
      String(10000000 + idx),
      `Egresado ${idx + 1}`,
      '2022',
      `egresado${idx + 1}@example.test`,
      '912345678',
    ]);
    const tooManyBuffer = await buildWorkbookBuffer(graduateHeaders, tooManyRows);
    expect((await postConfirm(listId, member.token).send(tooManyBuffer)).status).toBe(400);
  }, 5_000);

  it('returns 400 above the size limit', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const oversized = Buffer.alloc(STAKEHOLDER_IMPORT_MAX_FILE_BYTES + 1, 0x50);

    const response = await postConfirm(listId, member.token).send(oversized);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  }, 5_000);

  it('returns 404 for an unknown list', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['71234567', 'Docente', 'docente@example.test', '912345678'],
    ]);

    expect((await postConfirm('missing-list-id', member.token).send(buffer)).status).toBe(404);
    expect((await postConfirm('a'.repeat(70), member.token).send(buffer)).status).toBe(400);
  }, 5_000);

  it('returns 403 without constituyente.importar', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const actor = await createActor([]);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['71234567', 'Docente', 'docente@example.test', '912345678'],
    ]);

    expect((await postConfirm(listId, actor.token).send(buffer)).status).toBe(403);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });

    const response = await request(app)
      .post(`/stakeholder-lists/${listId}/import/confirm`)
      .set('Content-Type', STAKEHOLDER_IMPORT_XLSX_MIME)
      .send(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    expect(response.status).toBe(401);
  }, 5_000);

  it('confirm import called five times at once creates each stakeholder and member exactly once and never returns 500', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['72000001', 'Docente Uno', 'docente1@example.test', '912345601'],
      ['72000002', 'Docente Dos', 'docente2@example.test', '912345602'],
    ]);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => postConfirm(listId, member.token).send(buffer)),
    );

    const statuses = responses.map((res) => res.status);
    for (const status of statuses) {
      expect([201, 400, 409]).toContain(status);
      expect(status).toBeLessThan(500);
    }

    const successes = statuses.filter((status) => status === 201);
    expect(successes.length).toBeGreaterThanOrEqual(1);

    expect(await prisma.stakeholder.count({ where: { dni: '72000001' } })).toBe(1);
    expect(await prisma.stakeholder.count({ where: { dni: '72000002' } })).toBe(1);
    expect(await prisma.stakeholderListMember.count({ where: { listId } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { entity: 'StakeholderListImport' } })).toBe(
      successes.length,
    );
  }, 5_000);
});
