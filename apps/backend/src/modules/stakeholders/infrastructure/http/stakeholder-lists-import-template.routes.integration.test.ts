import ExcelJS from 'exceljs';
import request, { type Response } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { STAKEHOLDER_IMPORT_XLSX_MIME, STAKEHOLDER_LIST_TYPES } from '@sigoa/shared';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { getStakeholderImportColumns } from '../../domain/policies/stakeholder-import-columns.js';
import { ExcelJsStakeholderImportFileReader } from '../excel/exceljs-stakeholder-import-file-reader.js';

function binaryParser(res: Response, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });
  res.on('end', () => {
    callback(null, Buffer.concat(chunks));
  });
}

describe('GET /stakeholder-lists/excel-template (PostgreSQL real, HU-023, T-023-17, RF-023, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholder-import-template',
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

  it('downloads the template of each list type', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    for (const type of STAKEHOLDER_LIST_TYPES) {
      const response = await request(app)
        .get('/stakeholder-lists/excel-template')
        .query({ type })
        .set('Authorization', `Bearer ${member.token}`)
        .buffer(true)
        .parse(binaryParser);

      expect(response.status).toBe(200);
      const buffer = response.body as Buffer;
      expect(Buffer.isBuffer(buffer)).toBe(true);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      const sheet = workbook.getWorksheet('Constituyentes');
      expect(sheet).toBeDefined();
      const expectedHeaders = getStakeholderImportColumns(type).map((col) => col.header);
      const actualHeaders = expectedHeaders.map(
        (_, idx) => sheet?.getRow(1).getCell(idx + 1).value,
      );
      expect(actualHeaders).toEqual(expectedHeaders);
    }
  }, 5_000);

  it('reads back the downloaded template with the import reader', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);
    const response = await request(app)
      .get('/stakeholder-lists/excel-template')
      .query({ type: 'EMPLOYER' })
      .set('Authorization', `Bearer ${member.token}`)
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    const reader = new ExcelJsStakeholderImportFileReader();
    const rows = await reader.read(response.body as Buffer, 'EMPLOYER');
    expect(rows).toEqual([]);
  }, 5_000);

  it('returns 400 for a missing, unknown or extra query key', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const missing = await request(app)
      .get('/stakeholder-lists/excel-template')
      .set('Authorization', `Bearer ${member.token}`);
    expect(missing.status).toBe(400);

    const unknown = await request(app)
      .get('/stakeholder-lists/excel-template')
      .query({ type: 'INVALID_TYPE' })
      .set('Authorization', `Bearer ${member.token}`);
    expect(unknown.status).toBe(400);

    const extra = await request(app)
      .get('/stakeholder-lists/excel-template')
      .query({ type: 'TEACHER', extra: 'unexpected' })
      .set('Authorization', `Bearer ${member.token}`);
    expect(extra.status).toBe(400);
  }, 5_000);

  it('returns 403 without constituyente.importar', async () => {
    const actor = await createActor([]);

    const response = await request(app)
      .get('/stakeholder-lists/excel-template')
      .query({ type: 'TEACHER' })
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(403);
  }, 5_000);

  it('returns 401 without a token', async () => {
    const response = await request(app)
      .get('/stakeholder-lists/excel-template')
      .query({ type: 'TEACHER' });

    expect(response.status).toBe(401);
  }, 5_000);

  it('sends attachment headers and no-store', async () => {
    const member = await createActor(['COMMITTEE_MEMBER']);

    const response = await request(app)
      .get('/stakeholder-lists/excel-template')
      .query({ type: 'GRADUATE' })
      .set('Authorization', `Bearer ${member.token}`)
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-type']).toContain(STAKEHOLDER_IMPORT_XLSX_MIME);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="plantilla-graduate.xlsx"',
    );
  }, 5_000);
});
