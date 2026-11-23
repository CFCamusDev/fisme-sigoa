import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { resolutionDtoSchema } from '@sigoa/shared';
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
import {
  createInValidationCatalogVersion,
  createRegisteredResolution,
} from '../../../../test/factories/resolutions.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

describe('POST /resolutions (PostgreSQL real, HU-048, T-048-20, RF-048, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-resolutions-register-test',
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

  const post = (token: string) =>
    request(app).post('/resolutions').set('Authorization', `Bearer ${token}`);

  const body = (catalogVersionId: string, overrides: Record<string, unknown> = {}) => ({
    type: 'EDUCATIONAL_OBJECTIVE',
    number: 'RD-012/2027',
    issuedOn: '2026-11-10',
    catalogVersionId,
    ...overrides,
  });

  const count = () => prisma.resolution.count();
  const audits = () => prisma.auditLog.count({ where: { entity: 'Resolution' } });

  describe('Success (201)', () => {
    it('registers a resolution linked to the in-validation version and audits it (CA1)', async () => {
      const versionId = await createInValidationCatalogVersion(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await post(president.token).send(body(versionId));

      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toBe('no-store');
      const dto = resolutionDtoSchema.parse(response.body);
      expect(dto).toMatchObject({
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'RD-012/2027',
        issuedOn: '2026-11-10',
        status: 'REGISTERED',
        catalogVersionId: versionId,
      });
      const row = await prisma.resolution.findUniqueOrThrow({ where: { id: dto.id } });
      expect(row.status).toBe('REGISTERED');
      expect(row.createdBy).toBe(president.user.id);
      const events = await prisma.auditLog.findMany({ where: { entity: 'Resolution' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'CREATE',
        entityId: dto.id,
        actor: president.user.id,
      });
      expect(events[0]?.after).toMatchObject({ status: 'REGISTERED', number: 'RD-012/2027' });
    });

    it('returns null pdf and approval data (incomplete but valid)', async () => {
      const versionId = await createInValidationCatalogVersion(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await post(president.token).send(
        body(versionId, { type: 'GRADUATE_ATTRIBUTE' }),
      );

      expect(response.status).toBe(201);
      expect(resolutionDtoSchema.parse(response.body)).toMatchObject({
        type: 'GRADUATE_ATTRIBUTE',
        pdfFileId: null,
        approvedAt: null,
        approvedBy: null,
      });
    });

    it('trims the number', async () => {
      const versionId = await createInValidationCatalogVersion(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await post(president.token).send(body(versionId, { number: '  RD-7  ' }));

      expect(response.status).toBe(201);
      expect(response.body.number).toBe('RD-7');
    });
  });

  describe('Validation (400)', () => {
    it.each([
      ['unknown field', { status: 'APPROVED' }],
      ['number of 41 characters', { number: 'R'.repeat(41) }],
      ['number with symbols', { number: 'RD#1<x>' }],
      ['empty number', { number: '' }],
      ['non-existent date', { issuedOn: '2026-02-30' }],
      ['date with another format', { issuedOn: '10/11/2026' }],
      ['catalog version id of 65 characters', { catalogVersionId: 'v'.repeat(65) }],
      ['unknown type', { type: 'OTHER' }],
    ])('answers 400 for %s and persists nothing', async (_name, overrides) => {
      const versionId = await createInValidationCatalogVersion(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await post(president.token).send({ ...body(versionId), ...overrides });

      expect(response.status).toBe(400);
      expect(await count()).toBe(0);
      expect(await audits()).toBe(0);
    });

    it('answers 400 for an empty body', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await post(president.token).send({});

      expect(response.status).toBe(400);
      expect(await count()).toBe(0);
    });

    it('answers 400 for the improvement plan type until it is available', async () => {
      const versionId = await createInValidationCatalogVersion(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await post(president.token).send(
        body(versionId, { type: 'IMPROVEMENT_PLAN' }),
      );

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/Plan de Mejora/);
      expect(await count()).toBe(0);
    });
  });

  describe('Authentication and authorization', () => {
    it('answers 401 without a token', async () => {
      const response = await request(app).post('/resolutions').send(body('v1'));

      expect(response.status).toBe(401);
    });

    it.each(['COMMITTEE_MEMBER', 'TEACHER'])(
      'answers 403 for the %s role and persists nothing',
      async (role) => {
        const versionId = await createInValidationCatalogVersion(prisma);
        const actor = await createActor([role]);

        const response = await post(actor.token).send(body(versionId));

        expect(response.status).toBe(403);
        expect(await count()).toBe(0);
        expect(await audits()).toBe(0);
      },
    );
  });

  describe('Not found (404) and conflicts (409)', () => {
    it('answers 404 for a missing catalog version', async () => {
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await post(president.token).send(body('missing-version'));

      expect(response.status).toBe(404);
      expect(await count()).toBe(0);
      expect(await audits()).toBe(0);
    });

    it('answers 409 when the version is not in validation', async () => {
      const fixture = await createCatalogFixture(prisma);
      const draftId = await createDraftCatalogVersion(prisma, fixture);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await post(president.token).send(body(draftId));

      expect(response.status).toBe(409);
      expect(await count()).toBe(0);
      expect(await audits()).toBe(0);
    });

    it('answers 409 for a duplicated number and type and keeps the first one', async () => {
      const versionId1 = await createInValidationCatalogVersion(prisma);
      const versionId2 = await createInValidationCatalogVersion(prisma);
      await createRegisteredResolution(prisma, versionId1, { number: 'RD-012/2027' });
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await post(president.token).send(body(versionId2));

      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe(
        'Ya existe una resolución con ese número para este tipo.',
      );
      expect(response.body.error.details).toEqual([
        {
          path: 'number',
          message: 'Ya existe una resolución con ese número para este tipo.',
        },
      ]);
      expect(await count()).toBe(1);
      expect(await audits()).toBe(0);
    });

    it('answers 409 when the version already has a resolution of that type', async () => {
      const versionId = await createInValidationCatalogVersion(prisma);
      await createRegisteredResolution(prisma, versionId, { number: 'RD-001/2027' });
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const response = await post(president.token).send(body(versionId, { number: 'RD-002/2027' }));

      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe(
        'Esta versión del catálogo ya tiene una resolución de ese tipo.',
      );
      expect(response.body.error.details).toEqual([
        {
          path: 'catalogVersionId',
          message: 'Esta versión del catálogo ya tiene una resolución de ese tipo.',
        },
      ]);
      expect(await count()).toBe(1);
    });
  });

  describe('Concurrency', () => {
    it('lets exactly one of N concurrent registrations with the same number win', async () => {
      const versionIds = await Promise.all([
        createInValidationCatalogVersion(prisma),
        createInValidationCatalogVersion(prisma),
        createInValidationCatalogVersion(prisma),
      ]);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const responses = await Promise.all(
        versionIds.map((versionId) => post(president.token).send(body(versionId))),
      );

      const created = responses.filter((response) => response.status === 201);
      const conflicts = responses.filter((response) => response.status === 409);
      expect(created).toHaveLength(1);
      expect(conflicts).toHaveLength(2);
      for (const conflict of conflicts) {
        expect(conflict.body.error.message).toBe(
          'Ya existe una resolución con ese número para este tipo.',
        );
      }
      expect(await count()).toBe(1);
      expect(await audits()).toBe(1);
    }, 20_000);

    it('lets exactly one of N concurrent registrations for the same catalog version and type win', async () => {
      const versionId = await createInValidationCatalogVersion(prisma);
      const president = await createActor(['COMMITTEE_PRESIDENT']);

      const responses = await Promise.all([
        post(president.token).send(body(versionId, { number: 'RD-001/2027' })),
        post(president.token).send(body(versionId, { number: 'RD-002/2027' })),
        post(president.token).send(body(versionId, { number: 'RD-003/2027' })),
      ]);

      const created = responses.filter((response) => response.status === 201);
      const conflicts = responses.filter((response) => response.status === 409);
      expect(created).toHaveLength(1);
      expect(conflicts).toHaveLength(2);
      for (const conflict of conflicts) {
        expect(conflict.body.error.message).toBe(
          'Esta versión del catálogo ya tiene una resolución de ese tipo.',
        );
      }
      expect(await count()).toBe(1);
      expect(await audits()).toBe(1);
    }, 20_000);
  });
});
