import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { listResolutionsResponseSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createCatalogFixture } from '../../../../test/factories/catalog.js';
import {
  createInValidationCatalogVersion,
  createRegisteredResolution,
} from '../../../../test/factories/resolutions.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('GET /resolutions (PostgreSQL real, HU-048, T-048-22, RF-048, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-resolutions-list-test',
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

  const get = (token: string, query = '') =>
    request(app).get(`/resolutions${query}`).set('Authorization', `Bearer ${token}`);

  /** Una versión En validación con dos resoluciones (OE aprobada y AG registrada). */
  async function seedResolutions() {
    const versionId = await createInValidationCatalogVersion(prisma);
    const objectivesId = await createRegisteredResolution(prisma, versionId, {
      type: 'EDUCATIONAL_OBJECTIVE',
      number: 'RD-001/2027',
    });
    await createRegisteredResolution(prisma, versionId, {
      type: 'GRADUATE_ATTRIBUTE',
      number: 'RD-002/2027',
    });
    const file = await prisma.storedFile.create({
      data: {
        provider: 'in-memory',
        publicId: 'resolutions/file-1',
        url: 'memory://resolutions/file-1',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        sha256: 'd'.repeat(64),
      },
    });
    await prisma.resolution.update({
      where: { id: objectivesId },
      data: {
        status: 'APPROVED',
        pdfFileId: file.id,
        approvedAt: new Date('2026-11-14T09:00:00.000Z'),
        approvedBy: 'user-2',
      },
    });
    return { versionId, objectivesId };
  }

  describe('Success (200)', () => {
    it('lists the resolutions with their totals', async () => {
      await seedResolutions();
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await get(president.token);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const page = listResolutionsResponseSchema.parse(response.body);
      expect(page).toMatchObject({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
      expect(page.items).toHaveLength(2);
    });

    it('returns registered resolutions with null pdf and approval data (incomplete but valid)', async () => {
      await seedResolutions();
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await get(president.token, '?status=REGISTERED');

      const page = listResolutionsResponseSchema.parse(response.body);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        type: 'GRADUATE_ATTRIBUTE',
        number: 'RD-002/2027',
        status: 'REGISTERED',
        pdfFileId: null,
        approvedAt: null,
        approvedBy: null,
      });
    });

    it('returns approved resolutions with their pdf and approval data', async () => {
      const { objectivesId } = await seedResolutions();
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await get(president.token, '?status=APPROVED');

      const page = listResolutionsResponseSchema.parse(response.body);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        id: objectivesId,
        status: 'APPROVED',
        approvedBy: 'user-2',
      });
      expect(page.items[0]?.pdfFileId).not.toBeNull();
      expect(page.items[0]?.approvedAt).toBe('2026-11-14T09:00:00.000Z');
    });

    it('filters by type and by catalog version', async () => {
      const { versionId } = await seedResolutions();
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const byType = await get(president.token, '?type=EDUCATIONAL_OBJECTIVE');
      const byVersion = await get(president.token, `?catalogVersionId=${versionId}`);
      const byOtherVersion = await get(president.token, '?catalogVersionId=other-version');

      expect(
        listResolutionsResponseSchema.parse(byType.body).items.map((item) => item.number),
      ).toEqual(['RD-001/2027']);
      expect(listResolutionsResponseSchema.parse(byVersion.body).total).toBe(2);
      expect(listResolutionsResponseSchema.parse(byOtherVersion.body).total).toBe(0);
    });

    it('paginates and keeps the total', async () => {
      await seedResolutions();
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const first = listResolutionsResponseSchema.parse(
        (await get(president.token, '?page=1&pageSize=1')).body,
      );
      const second = listResolutionsResponseSchema.parse(
        (await get(president.token, '?page=2&pageSize=1')).body,
      );
      const beyond = listResolutionsResponseSchema.parse(
        (await get(president.token, '?page=3&pageSize=1')).body,
      );

      expect(first).toMatchObject({ total: 2, totalPages: 2 });
      expect(first.items).toHaveLength(1);
      expect(second.items).toHaveLength(1);
      expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
      expect(beyond.items).toEqual([]);
      expect(beyond.total).toBe(2);
    });

    it('answers an empty list when there are no resolutions', async () => {
      await createCatalogFixture(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await get(president.token);

      expect(response.status).toBe(200);
      expect(listResolutionsResponseSchema.parse(response.body)).toEqual({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it('lets a committee member read the list (view only)', async () => {
      await seedResolutions();
      const member = await createActor(['COMMITTEE_MEMBER']);

      const response = await get(member.token);

      expect(response.status).toBe(200);
      expect(listResolutionsResponseSchema.parse(response.body).total).toBe(2);
    });
  });

  describe('Validation (400)', () => {
    it.each([
      ['pageSize over the limit', '?pageSize=101'],
      ['page zero', '?page=0'],
      ['page over the limit', '?page=10001'],
      ['fractional page', '?page=1.5'],
      ['invalid type', '?type=OTHER'],
      ['invalid status', '?status=DRAFT'],
      ['catalog version id of 65 characters', `?catalogVersionId=${'v'.repeat(65)}`],
      ['unknown key', '?foo=bar'],
    ])('answers 400 for %s', async (_name, query) => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await get(president.token, query);

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication and authorization', () => {
    it('answers 401 without a token', async () => {
      const response = await request(app).get('/resolutions');

      expect(response.status).toBe(401);
    });

    it('answers 403 for a teacher', async () => {
      await seedResolutions();
      const teacher = await createActor(['TEACHER']);

      const response = await get(teacher.token);

      expect(response.status).toBe(403);
    });
  });
});
