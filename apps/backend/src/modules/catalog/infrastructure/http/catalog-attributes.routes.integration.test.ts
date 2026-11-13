import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { catalogAttributesResponseSchema } from '@sigoa/shared';
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

describe('PUT /catalog-versions/:id/attributes (PostgreSQL real, HU-014, T-014-16, CA1, CA2, CA3, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-catalog-attributes-test',
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

  async function createActor(roles: string[]) {
    return createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });
  }

  async function setup() {
    const fixture = await createCatalogFixture(prisma);
    const draftId = await createDraftCatalogVersion(prisma, fixture);
    const member = await createActor(['COMMITTEE_MEMBER']);
    return { fixture, draftId, member };
  }

  const put = (token: string, versionId: string) =>
    request(app)
      .put(`/catalog-versions/${versionId}/attributes`)
      .set('Authorization', `Bearer ${token}`);

  const auditCount = (entity: string) => prisma.auditLog.count({ where: { entity } });

  describe('Success (200)', () => {
    it('updates the statement of an attribute in a draft version (CA1)', async () => {
      const { fixture, draftId, member } = await setup();
      const target = await prisma.graduateAttribute.findFirstOrThrow({
        where: { versionId: draftId, code: 'AG-C03' },
      });

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        id: target.id,
        code: 'AG-C03',
        name: target.name,
        statement: 'Nuevo enunciado oficial del atributo.',
      });

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = catalogAttributesResponseSchema.parse(response.body);
      expect(body.items).toHaveLength(12);
      expect(body.items[2]).toMatchObject({
        code: 'AG-C03',
        order: 3,
        statement: 'Nuevo enunciado oficial del atributo.',
      });

      // La vigente conserva el enunciado anterior: la diferencia es visible.
      const current = await prisma.graduateAttribute.findFirstOrThrow({
        where: { versionId: fixture.currentVersionId!, code: 'AG-C03' },
      });
      expect(current.statement).toBe('Enunciado del atributo 3.');

      const events = await prisma.auditLog.findMany({ where: { entity: 'GraduateAttribute' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ action: 'UPDATE', entityId: target.id });
      expect(events[0]?.before).toMatchObject({ statement: 'Enunciado del atributo 3.' });
      expect(events[0]?.after).toMatchObject({
        statement: 'Nuevo enunciado oficial del atributo.',
      });
    });

    it('adds an attribute with name and statement of one character (incomplete but valid)', async () => {
      const { draftId, member } = await setup();

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        code: 'AG-C13',
        name: 'N',
        statement: 'x',
      });

      expect(response.status).toBe(200);
      const body = catalogAttributesResponseSchema.parse(response.body);
      expect(body.items.at(-1)).toMatchObject({ code: 'AG-C13', name: 'N', order: 13 });
      const events = await prisma.auditLog.findMany({ where: { entity: 'GraduateAttribute' } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ action: 'CREATE' });
    });

    it('reorders the attributes and audits the new order of codes', async () => {
      const { draftId, member } = await setup();
      const rows = await prisma.graduateAttribute.findMany({
        where: { versionId: draftId },
        orderBy: { order: 'asc' },
      });
      const [first, second, ...rest] = rows;

      const response = await put(member.token, draftId).send({
        operation: 'REORDER',
        orderedIds: [second!, first!, ...rest].map((row) => row.id),
      });

      expect(response.status).toBe(200);
      const body = catalogAttributesResponseSchema.parse(response.body);
      expect(body.items.slice(0, 3).map((item) => [item.code, item.order])).toEqual([
        ['AG-C02', 1],
        ['AG-C01', 2],
        ['AG-C03', 3],
      ]);
      expect(body.items.map((item) => item.order)).toEqual(
        Array.from({ length: 12 }, (_, index) => index + 1),
      );
      expect(await auditCount('CatalogVersion')).toBe(1);
    });
  });

  describe('Conflicts (409) and not found (404)', () => {
    it('answers 409 when the code already exists (CA2)', async () => {
      const { draftId, member } = await setup();

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        code: 'AG-C05',
        name: 'Repetido',
        statement: 'Repetido.',
      });

      expect(response.status).toBe(409);
      expect(await prisma.graduateAttribute.count({ where: { versionId: draftId } })).toBe(12);
      expect(await auditCount('GraduateAttribute')).toBe(0);
    });

    it('answers 409 when editing to the code of another attribute (CA2)', async () => {
      const { draftId, member } = await setup();
      const target = await prisma.graduateAttribute.findFirstOrThrow({
        where: { versionId: draftId, code: 'AG-C01' },
      });

      const response = await put(member.token, draftId).send({
        operation: 'SAVE',
        id: target.id,
        code: 'AG-C02',
        name: target.name,
        statement: target.statement,
      });

      expect(response.status).toBe(409);
    });

    it.each(['APPROVED', 'IN_VALIDATION'] as const)(
      'answers 409 for a version that is not a draft (%s) (CA3)',
      async (status) => {
        const { draftId, fixture, member } = await setup();
        const versionId = status === 'APPROVED' ? fixture.currentVersionId! : draftId;
        if (status === 'IN_VALIDATION') {
          await prisma.catalogVersion.update({ where: { id: draftId }, data: { status } });
        }

        const response = await put(member.token, versionId).send({
          operation: 'SAVE',
          code: 'AG-C20',
          name: 'Nuevo',
          statement: 'Nuevo.',
        });

        expect(response.status).toBe(409);
        expect(await prisma.graduateAttribute.count({ where: { code: 'AG-C20' } })).toBe(0);
        expect(await auditCount('GraduateAttribute')).toBe(0);
      },
    );

    it('answers 409 when reordering a version that is not a draft (CA3)', async () => {
      const { fixture, member } = await setup();
      const rows = await prisma.graduateAttribute.findMany({
        where: { versionId: fixture.currentVersionId! },
        orderBy: { order: 'asc' },
      });

      const response = await put(member.token, fixture.currentVersionId!).send({
        operation: 'REORDER',
        orderedIds: [...rows].reverse().map((row) => row.id),
      });

      expect(response.status).toBe(409);
    });

    it('answers 409 when the list to reorder is outdated', async () => {
      const { draftId, member } = await setup();

      const response = await put(member.token, draftId).send({
        operation: 'REORDER',
        orderedIds: ['one', 'two'],
      });

      expect(response.status).toBe(409);
      expect(await auditCount('CatalogVersion')).toBe(0);
    });

    it('answers 404 for a version that does not exist', async () => {
      const { member } = await setup();

      const response = await put(member.token, 'missing-version').send({
        operation: 'SAVE',
        code: 'AG-C20',
        name: 'Nuevo',
        statement: 'Nuevo.',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('Concurrency', () => {
    it('keeps orders unique and gapless under concurrent reorders', async () => {
      const { draftId, member } = await setup();
      const rows = await prisma.graduateAttribute.findMany({
        where: { versionId: draftId },
        orderBy: { order: 'asc' },
      });
      const ids = rows.map((row) => row.id);
      const reversed = [...ids].reverse();
      const rotated = [...ids.slice(1), ids[0]!];

      const responses = await Promise.all(
        [reversed, rotated, ids, reversed].map((orderedIds) =>
          put(member.token, draftId).send({ operation: 'REORDER', orderedIds }),
        ),
      );

      for (const response of responses) {
        expect([200, 409]).toContain(response.status);
      }
      expect(responses.some((response) => response.status === 200)).toBe(true);
      const after = await prisma.graduateAttribute.findMany({
        where: { versionId: draftId },
        orderBy: { order: 'asc' },
      });
      expect(after.map((row) => row.order)).toEqual(
        Array.from({ length: 12 }, (_, index) => index + 1),
      );
      expect(new Set(after.map((row) => row.code)).size).toBe(12);
    }, 20_000);
  });

  describe('Validation (400)', () => {
    it.each([
      ['a missing name', { operation: 'SAVE', code: 'AG-C13', statement: 'x' }],
      [
        'a name of 121 characters',
        { operation: 'SAVE', code: 'AG-C13', name: 'n'.repeat(121), statement: 'x' },
      ],
      ['an empty name', { operation: 'SAVE', code: 'AG-C13', name: ' ', statement: 'x' }],
      [
        'an extra field',
        { operation: 'SAVE', code: 'AG-C13', name: 'N', statement: 'x', order: 3 },
      ],
      ['an unknown operation', { operation: 'REMOVE', code: 'AG-C13', name: 'N', statement: 'x' }],
      ['an invalid code', { operation: 'SAVE', code: 'ag c13', name: 'N', statement: 'x' }],
      [
        'a statement of 2001 characters',
        { operation: 'SAVE', code: 'AG-C13', name: 'N', statement: 'x'.repeat(2001) },
      ],
      ['a repeated reorder list', { operation: 'REORDER', orderedIds: ['a', 'a'] }],
      ['an empty reorder list', { operation: 'REORDER', orderedIds: [] }],
    ])('answers 400 for %s without persisting or auditing', async (_name, payload) => {
      const { draftId, member } = await setup();

      const response = await put(member.token, draftId).send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.graduateAttribute.count({ where: { versionId: draftId } })).toBe(12);
      expect(await auditCount('GraduateAttribute')).toBe(0);
      expect(await auditCount('CatalogVersion')).toBe(0);
    });
  });

  describe('Authentication & Authorization (401, 403)', () => {
    it('answers 401 without token', async () => {
      const response = await request(app)
        .put('/catalog-versions/v1/attributes')
        .send({ operation: 'REORDER', orderedIds: ['a'] });
      expect(response.status).toBe(401);
    });

    it.each([[[]], [['TEACHER']], [['ADMINISTRATOR']], [['PROGRAM_DIRECTOR']]])(
      'answers 403 and audits ACCESS_DENIED for roles %j, who lack catalogo.editar (RNF-009)',
      async (roles) => {
        const { draftId } = await setup();
        const actor = await createActor(roles as string[]);

        const response = await put(actor.token, draftId).send({
          operation: 'SAVE',
          code: 'AG-C20',
          name: 'Nuevo',
          statement: 'Nuevo.',
        });

        expect(response.status).toBe(403);
        expect(await prisma.graduateAttribute.count({ where: { code: 'AG-C20' } })).toBe(0);
        expect(await auditCount('GraduateAttribute')).toBe(0);
        const denied = await prisma.auditLog.findFirst({
          where: { action: 'ACCESS_DENIED', actor: actor.user.id },
        });
        expect(denied).not.toBeNull();
      },
    );
  });
});
