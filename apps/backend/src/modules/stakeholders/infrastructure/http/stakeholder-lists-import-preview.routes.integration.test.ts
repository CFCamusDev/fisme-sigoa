import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  STAKEHOLDER_IMPORT_MAX_FILE_BYTES,
  STAKEHOLDER_IMPORT_XLSX_MIME,
  previewStakeholderImportResponseSchema,
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
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { getStakeholderImportColumns } from '../../domain/policies/stakeholder-import-columns.js';

async function buildWorkbookBuffer(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<ExcelJS.CellValue>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Constituyentes');
  sheet.addRow([...headers]);
  for (const row of rows) {
    sheet.addRow([...row]);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('POST /stakeholder-lists/:id/import/preview (PostgreSQL real, HU-023, T-023-15, CA1, CA3, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholder-import-preview',
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

  const postPreview = (listId: string, token: string, mime = STAKEHOLDER_IMPORT_XLSX_MIME) =>
    request(app)
      .post(`/stakeholder-lists/${listId}/import/preview`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', mime);

  it('returns the preview with valid and invalid rows', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    await createStakeholderRow(prisma, {
      kind: 'PERSON',
      fullName: 'Rosa Diaz Paredes',
      dni: '45678912',
      email: 'rosa.diaz@example.test',
      mobile: '987654321',
    });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['1234567', 'Docente Cero', 'docente.cero@example.test', '912345678'],
      ['45678912', 'Rosa Diaz Paredes', 'rosa.diaz@example.test', '987654321'],
      [
        '123',
        { formula: 'HYPERLINK("https://example.test","Link")' },
        'bad@example.test',
        '912345670',
      ],
      ['71234569', 'A'.repeat(10_000), 'largo@example.test', '912345671'],
    ]);

    const response = await postPreview(listId, member.token).send(buffer);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const dto = previewStakeholderImportResponseSchema.parse(response.body);
    expect(dto.listId).toBe(listId);
    expect(dto.listType).toBe('TEACHER');
    expect(dto.totals).toEqual({
      total: 4,
      new: 1,
      existing: 1,
      alreadyInList: 0,
      invalid: 2,
    });
    expect(dto.rows[0]?.document).toBe('01234567');
    expect(dto.rows[0]?.status).toBe('NEW');
    expect(dto.rows[1]?.status).toBe('EXISTING');
    expect(dto.rows[2]?.status).toBe('INVALID');
    expect(dto.rows[3]?.status).toBe('INVALID');
  }, 5_000);

  it('leaves the database unchanged', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['71234567', 'Mario Quispe', 'mario@example.test', '912345678'],
    ]);

    const beforeStakeholders = await prisma.stakeholder.count();
    const beforeMembers = await prisma.stakeholderListMember.count();
    const beforeAudits = await prisma.auditLog.count();

    const response = await postPreview(listId, member.token).send(buffer);
    expect(response.status).toBe(200);

    expect(await prisma.stakeholder.count()).toBe(beforeStakeholders);
    expect(await prisma.stakeholderListMember.count()).toBe(beforeMembers);
    expect(await prisma.auditLog.count()).toBe(beforeAudits);
  }, 5_000);

  it('returns 400 for an empty body', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await postPreview(listId, member.token).send(Buffer.alloc(0));
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 for a file that is not an xlsx or wrong Content-Type', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);

    const badBytesResponse = await postPreview(listId, member.token).send(
      Buffer.from('not-an-xlsx-file', 'utf8'),
    );
    expect(badBytesResponse.status).toBe(400);

    const badMimeResponse = await postPreview(listId, member.token, 'application/json').send({
      any: 'json',
    });
    expect(badMimeResponse.status).toBe(400);
  }, 5_000);

  it('returns 400 for headers of another list type', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'GRADUATE', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const teacherHeaders = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(teacherHeaders, [
      ['71234567', 'Docente Uno', 'docente@example.test', '912345678'],
    ]);

    const response = await postPreview(listId, member.token).send(buffer);
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 above 500 rows', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const rows = Array.from({ length: 501 }, (_, idx) => [
      String(10000000 + idx),
      `Docente ${idx + 1}`,
      `docente${idx + 1}@example.test`,
      '912345678',
    ]);
    const buffer = await buildWorkbookBuffer(headers, rows);

    const response = await postPreview(listId, member.token).send(buffer);
    expect(response.status).toBe(400);
  }, 5_000);

  it('returns 400 above the size limit', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const oversized = Buffer.alloc(STAKEHOLDER_IMPORT_MAX_FILE_BYTES + 1, 0x50);

    const response = await postPreview(listId, member.token).send(oversized);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  }, 5_000);

  it('returns 404 for an unknown list and 400 for invalid id format', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['71234567', 'Docente Uno', 'docente@example.test', '912345678'],
    ]);

    const unknownResponse = await postPreview('non-existent-list-id', member.token).send(buffer);
    expect(unknownResponse.status).toBe(404);

    const invalidIdResponse = await postPreview('a'.repeat(70), member.token).send(buffer);
    expect(invalidIdResponse.status).toBe(400);
  }, 5_000);

  it('returns 403 without constituyente.importar', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const withoutPermission = await createActor([]);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['71234567', 'Docente Uno', 'docente@example.test', '912345678'],
    ]);

    const response = await postPreview(listId, withoutPermission.token).send(buffer);
    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });

    const response = await request(app)
      .post(`/stakeholder-lists/${listId}/import/preview`)
      .set('Content-Type', STAKEHOLDER_IMPORT_XLSX_MIME)
      .send(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    expect(response.status).toBe(401);
  }, 5_000);

  it('does not return email or mobile in the preview', async () => {
    const listId = await createStakeholderListRow(prisma, { type: 'TEACHER', year: 2027 });
    const member = await createActor(['COMMITTEE_MEMBER']);
    const headers = getStakeholderImportColumns('TEACHER').map((col) => col.header);
    const buffer = await buildWorkbookBuffer(headers, [
      ['71234567', 'Mario Quispe', 'secreto.personal@example.test', '987654321'],
    ]);

    const response = await postPreview(listId, member.token).send(buffer);

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('secreto.personal@example.test');
    expect(serialized).not.toContain('987654321');
    expect(response.body.rows[0]?.email).toBeUndefined();
    expect(response.body.rows[0]?.mobile).toBeUndefined();
  }, 5_000);
});
