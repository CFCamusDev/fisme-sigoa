import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { catalogComparisonDtoSchema, catalogVersionDetailDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import {
  createCatalogFixture,
  createDraftCatalogVersion,
} from '../../../../test/factories/catalog.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('GET /catalog-versions/:baseId/compare/:targetId (PostgreSQL real, HU-017, T-017-10, RF-017, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-catalog-comparison-test',
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

  /** Programa con la versión 1 vigente y la versión 2 en Borrador con cambios de texto. */
  async function setup(programId = 'comparison-program') {
    const fixture = await createCatalogFixture(prisma, { programId });
    const v1 = fixture.currentVersionId as string;
    const v2 = await createDraftCatalogVersion(prisma, fixture);
    await prisma.educationalObjective.updateMany({
      where: { versionId: v2, code: 'OEP1' },
      data: { statement: 'Enunciado corregido del objetivo 1.' },
    });
    await prisma.educationalObjective.deleteMany({ where: { versionId: v2, code: 'OEP4' } });
    await prisma.educationalObjective.create({
      data: { versionId: v2, code: 'OEP5', statement: 'Objetivo nuevo.', order: 4 },
    });
    const member = await createActor(['COMMITTEE_MEMBER']);
    return { fixture, v1, v2, member };
  }

  const compare = (token: string, baseId: string, targetId: string) =>
    request(app)
      .get(`/catalog-versions/${baseId}/compare/${targetId}`)
      .set('Authorization', `Bearer ${token}`);

  async function approveResolution(versionId: string, number: string, approvedAt: string) {
    await prisma.resolution.create({
      data: {
        type: 'EDUCATIONAL_OBJECTIVE',
        number,
        issuedOn: new Date('2024-02-20T00:00:00.000Z'),
        status: 'APPROVED',
        approvedAt: new Date(approvedAt),
        approvedBy: 'SEED',
        catalogVersionId: versionId,
        createdBy: 'SEED',
      },
    });
  }

  describe('Success (200)', () => {
    it('returns highlighted text differences between two versions', async () => {
      const { v1, v2, member } = await setup();

      const response = await compare(member.token, v1, v2);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = catalogComparisonDtoSchema.parse(response.body);
      expect(body.summary).toEqual({ added: 1, removed: 1, modified: 1, unchanged: 14 });
      expect(body.objectives.map((item) => [item.code, item.change])).toEqual([
        ['OEP1', 'MODIFIED'],
        ['OEP2', 'UNCHANGED'],
        ['OEP3', 'UNCHANGED'],
        ['OEP5', 'ADDED'],
        ['OEP4', 'REMOVED'],
      ]);
      const modified = body.objectives[0];
      expect(modified?.statementSegments.some((segment) => segment.type === 'ADDED')).toBe(true);
      expect(modified?.statementSegments.some((segment) => segment.type === 'REMOVED')).toBe(true);
      expect(body.attributes).toHaveLength(12);
      expect(JSON.stringify(body)).not.toContain('SEED');
    }, 30_000);

    it('exposes resolution and validity of a historical version', async () => {
      const { v1, v2, member } = await setup();
      await prisma.catalogVersion.update({ where: { id: v1 }, data: { status: 'HISTORICAL' } });
      await prisma.catalogVersion.update({ where: { id: v2 }, data: { status: 'APPROVED' } });
      await approveResolution(v1, '128-2024', '2024-03-01T10:00:00.000Z');
      await approveResolution(v2, '210-2026', '2026-05-10T09:00:00.000Z');

      const detail = await request(app)
        .get(`/catalog-versions/${v1}`)
        .set('Authorization', `Bearer ${member.token}`);

      expect(detail.status).toBe(200);
      const body = catalogVersionDetailDtoSchema.parse(detail.body);
      expect(body.history).toMatchObject({
        validFrom: '2024-03-01T10:00:00.000Z',
        validUntil: '2026-05-10T09:00:00.000Z',
      });
      expect(body.history.resolutions).toEqual([
        {
          id: expect.any(String),
          type: 'EDUCATIONAL_OBJECTIVE',
          number: '128-2024',
          issuedOn: '2024-02-20',
          status: 'APPROVED',
          approvedAt: '2024-03-01T10:00:00.000Z',
          hasPdf: false,
        },
      ]);

      const comparison = await compare(member.token, v1, v2);
      expect(comparison.status).toBe(200);
      expect(
        catalogComparisonDtoSchema.parse(comparison.body).target.history.validUntil,
      ).toBeNull();
    }, 30_000);

    it('compares versions without items and without resolutions', async () => {
      const fixture = await createCatalogFixture(prisma, {
        programId: 'empty-program',
        objectiveCount: 0,
        attributeCount: 0,
      });
      const emptyDraft = await createDraftCatalogVersion(prisma, fixture, {
        objectiveCount: 0,
        attributeCount: 0,
      });
      const member = await createActor(['COMMITTEE_MEMBER']);

      const response = await compare(member.token, fixture.currentVersionId as string, emptyDraft);

      expect(response.status).toBe(200);
      const body = catalogComparisonDtoSchema.parse(response.body);
      expect(body.summary).toEqual({ added: 0, removed: 0, modified: 0, unchanged: 0 });
      expect(body.base.history).toEqual({ validFrom: null, validUntil: null, resolutions: [] });
    }, 30_000);
  });

  describe('Validation (400) and not found (404)', () => {
    it('answers 400 when both identifiers are the same version', async () => {
      const { v1, member } = await setup();

      const response = await compare(member.token, v1, v1);

      expect(response.status).toBe(400);
    }, 30_000);

    it('answers 400 when the versions belong to different programs', async () => {
      const { v1, member } = await setup();
      const other = await setup('other-program');

      const response = await compare(member.token, v1, other.v1);

      expect(response.status).toBe(400);
    }, 30_000);

    it('answers 400 for an identifier over the limit', async () => {
      const { v1, member } = await setup();

      const response = await compare(member.token, v1, 'x'.repeat(10_000));

      expect(response.status).toBe(400);
    }, 30_000);

    it('answers 400 for an unknown query parameter', async () => {
      const { v1, v2, member } = await setup();

      const response = await compare(member.token, v1, v2).query({ page: '1' });

      expect(response.status).toBe(400);
    }, 30_000);

    it('answers 404 for a version that does not exist', async () => {
      const { v1, member } = await setup();

      const response = await compare(member.token, v1, 'does-not-exist');

      expect(response.status).toBe(404);
    }, 30_000);
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app).get('/catalog-versions/a/compare/b');

      expect(response.status).toBe(401);
    });

    it('answers 403 and audits ACCESS_DENIED for a user without catalogo.ver (RNF-009)', async () => {
      const { v1, v2 } = await setup();
      const actor = await createActor([]);

      const response = await compare(actor.token, v1, v2);

      expect(response.status).toBe(403);
      const denied = await prisma.auditLog.findFirst({
        where: { action: 'ACCESS_DENIED', actor: actor.user.id },
      });
      expect(denied).not.toBeNull();
    }, 30_000);
  });
});
