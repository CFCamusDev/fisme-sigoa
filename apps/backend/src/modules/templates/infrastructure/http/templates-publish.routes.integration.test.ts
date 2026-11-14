import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { templateVersionDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import {
  createRoleWithGrants,
  seedAuthorizationFast,
} from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

const PUBLISHED_AT = new Date('2026-11-01T10:00:00.000Z');
const DRAFT_AT = new Date('2026-11-05T10:00:00.000Z');
const CONCURRENT_CALLERS = 5;

describe('POST /templates/:id/publish (PostgreSQL real, HU-018, T-018-28, RF-018, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-templates-publish-test',
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

  const post = (token: string, id: string, body: unknown) =>
    request(app)
      .post(`/templates/${id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  const publishBody = (versionId = 'v2', expectedUpdatedAt = DRAFT_AT.toISOString()) => ({
    versionId,
    expectedUpdatedAt,
  });

  async function seedTemplate(withPublished = true, draftContent = '<p>{{program.name}} v2</p>') {
    await prisma.template.create({
      data: {
        id: 't1',
        code: 'FO-01',
        name: 'Anexo 1',
        type: 'ANNEX',
        variables: [{ key: 'program.name', label: 'Programa' }],
      },
    });
    if (withPublished) {
      await prisma.templateVersion.create({
        data: {
          id: 'v1',
          templateId: 't1',
          number: 1,
          status: 'PUBLISHED',
          content: '<p>contenido de la versión 1</p>',
          publishedAt: PUBLISHED_AT,
          publishedBy: 'seed',
          updatedAt: PUBLISHED_AT,
        },
      });
    }
    await prisma.templateVersion.create({
      data: {
        id: 'v2',
        templateId: 't1',
        number: withPublished ? 2 : 1,
        status: 'DRAFT',
        content: draftContent,
        updatedAt: DRAFT_AT,
      },
    });
  }

  describe('Success', () => {
    it('publishes the draft and obsoletes the previous version', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await post(admin.token, 't1', publishBody());

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const published = templateVersionDtoSchema.parse(response.body);
      expect(published).toMatchObject({ id: 'v2', number: 2, status: 'PUBLISHED' });
      expect(published.publishedAt).not.toBeNull();
      expect((await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v1' } })).status).toBe(
        'OBSOLETE',
      );
      expect(
        await prisma.templateVersion.count({ where: { templateId: 't1', status: 'PUBLISHED' } }),
      ).toBe(1);
    });

    it('keeps version 1 content unchanged after version 2 is published', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      await post(admin.token, 't1', publishBody());

      const first = await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v1' } });
      expect(first.content).toBe('<p>contenido de la versión 1</p>');
      expect(first.number).toBe(1);
      expect(first.publishedAt).toEqual(PUBLISHED_AT);
      expect(first.publishedBy).toBe('seed');
    });

    it('publishes the first version when there is no previous published one', async () => {
      await seedTemplate(false);
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await post(admin.token, 't1', publishBody());

      expect(response.status).toBe(200);
      expect(templateVersionDtoSchema.parse(response.body)).toMatchObject({
        number: 1,
        status: 'PUBLISHED',
      });
      expect(await prisma.auditLog.count({ where: { entity: 'TemplateVersion' } })).toBe(1);
    });

    it('audits both transitions with the actor', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      await post(admin.token, 't1', publishBody());

      const audits = await prisma.auditLog.findMany({
        where: { entity: 'TemplateVersion' },
        orderBy: { sequence: 'asc' },
      });
      expect(audits.map((audit) => [audit.entityId, audit.action, audit.actor])).toEqual([
        ['v1', 'STATE_CHANGE', admin.user.id],
        ['v2', 'STATE_CHANGE', admin.user.id],
      ]);
    });
  });

  describe('Validation (400)', () => {
    it.each([
      ['missing expectedUpdatedAt', { versionId: 'v2' }],
      [
        'expectedUpdatedAt that is not an ISO date',
        { versionId: 'v2', expectedUpdatedAt: '05/11/2026' },
      ],
      ['empty expectedUpdatedAt', { versionId: 'v2', expectedUpdatedAt: '' }],
      ['missing versionId', { expectedUpdatedAt: DRAFT_AT.toISOString() }],
      ['empty versionId', { versionId: '', expectedUpdatedAt: DRAFT_AT.toISOString() }],
      [
        'versionId of 65 characters',
        { versionId: 'v'.repeat(65), expectedUpdatedAt: DRAFT_AT.toISOString() },
      ],
      ['unknown field', { versionId: 'v2', expectedUpdatedAt: DRAFT_AT.toISOString(), extra: 1 }],
    ])('answers 400 for %s and changes nothing', async (_name, body) => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await post(admin.token, 't1', body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect((await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v2' } })).status).toBe(
        'DRAFT',
      );
      expect(await prisma.auditLog.count({ where: { entity: 'TemplateVersion' } })).toBe(0);
    });

    it('answers 400 for an id of 65 characters', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await post(admin.token, 't'.repeat(65), publishBody());

      expect(response.status).toBe(400);
    });

    it('answers 400 and publishes nothing when the stored draft no longer passes the content rules', async () => {
      await seedTemplate(true, '<p>x</p><script>alert(1)</script>');
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await post(admin.token, 't1', publishBody());

      expect(response.status).toBe(400);
      expect((await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v1' } })).status).toBe(
        'PUBLISHED',
      );
    });
  });

  describe('Authentication, authorization and not found', () => {
    it('answers 401 without a token', async () => {
      const response = await request(app).post('/templates/t1/publish').send(publishBody());

      expect(response.status).toBe(401);
    });

    it('answers 403 for a user who can only edit, not publish', async () => {
      await seedTemplate();
      const role = await createRoleWithGrants(prisma, {
        name: 'Solo edita plantillas',
        grants: [{ permissionCode: 'plantilla.editar', scope: 'GLOBAL' }],
      });
      const editor = await createActor([role.code]);

      const response = await post(editor.token, 't1', publishBody());

      expect(response.status).toBe(403);
      expect((await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v2' } })).status).toBe(
        'DRAFT',
      );
    });

    it.each([['COMMITTEE_MEMBER'], ['TEACHER']])('answers 403 for %s', async (role) => {
      await seedTemplate();
      const viewer = await createActor([role]);

      const response = await post(viewer.token, 't1', publishBody());

      expect(response.status).toBe(403);
    });

    it('answers 404 for an unknown template', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await post(admin.token, 'does-not-exist', publishBody());

      expect(response.status).toBe(404);
    });

    it('answers 404 for an unknown version', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await post(admin.token, 't1', publishBody('nope'));

      expect(response.status).toBe(404);
    });

    it('answers 404 for a version that belongs to another template', async () => {
      await seedTemplate();
      await prisma.template.create({
        data: { id: 't2', code: 'FO-02', name: 'Anexo 2', type: 'ANNEX' },
      });
      await prisma.templateVersion.create({
        data: { id: 'other-draft', templateId: 't2', number: 1, content: '<p>otra</p>' },
      });
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await post(admin.token, 't1', publishBody('other-draft'));

      expect(response.status).toBe(404);
      expect(
        (await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'other-draft' } })).status,
      ).toBe('DRAFT');
    });
  });

  describe('Conflicts (409)', () => {
    it('answers 409 when the draft was already published', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);
      await post(admin.token, 't1', publishBody());

      const response = await post(admin.token, 't1', publishBody());

      expect(response.status).toBe(409);
      expect(await prisma.auditLog.count({ where: { entity: 'TemplateVersion' } })).toBe(2);
    });

    it('answers 409 when the draft changed after the administrator reviewed it', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await post(
        admin.token,
        't1',
        publishBody('v2', new Date('2026-11-04T10:00:00.000Z').toISOString()),
      );

      expect(response.status).toBe(409);
      expect((await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v2' } })).status).toBe(
        'DRAFT',
      );
      expect((await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v1' } })).status).toBe(
        'PUBLISHED',
      );
    });

    it('answers 409 when the version is the one already published', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await post(admin.token, 't1', publishBody('v1', PUBLISHED_AT.toISOString()));

      expect(response.status).toBe(409);
    });
  });

  describe('Concurrency (PostgreSQL real, N = 5)', () => {
    it('lets exactly one of N simultaneous publications return 200', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      const responses = await Promise.all(
        Array.from({ length: CONCURRENT_CALLERS }, () => post(admin.token, 't1', publishBody())),
      );

      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([200, 409, 409, 409, 409]);
      expect(
        await prisma.templateVersion.count({ where: { templateId: 't1', status: 'PUBLISHED' } }),
      ).toBe(1);
      expect((await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v1' } })).status).toBe(
        'OBSOLETE',
      );
      expect(await prisma.auditLog.count({ where: { entity: 'TemplateVersion' } })).toBe(2);
    }, 20_000);
  });
});
