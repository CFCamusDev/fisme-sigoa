import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { TEMPLATE_CONTENT_MAX_LENGTH, templateVersionDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';

const PUBLISHED_AT = new Date('2026-11-01T10:00:00.000Z');
const CONCURRENT_CALLERS = 5;
const HTML = '<p>{{program.name}} nuevo contenido</p>';

describe('PUT /templates/:id/draft (PostgreSQL real, HU-018, T-018-27, RF-018, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-templates-draft-test',
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

  const put = (token: string, id: string, body: unknown) =>
    request(app)
      .put(`/templates/${id}/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  async function seedTemplate(withPublished = true) {
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
        },
      });
    }
  }

  describe('Success', () => {
    it('answers 201 and creates the draft as the next version', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await put(admin.token, 't1', { content: HTML });

      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toBe('no-store');
      const version = templateVersionDtoSchema.parse(response.body);
      expect(version).toMatchObject({
        number: 2,
        status: 'DRAFT',
        publishedAt: null,
        content: HTML,
      });
      expect(
        (await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v1' } })).content,
      ).toBe('<p>contenido de la versión 1</p>');
    });

    it('answers 201 with version 1 for a template without versions (incomplete but valid)', async () => {
      await seedTemplate(false);
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await put(admin.token, 't1', { content: HTML });

      expect(response.status).toBe(201);
      expect(templateVersionDtoSchema.parse(response.body)).toMatchObject({
        number: 1,
        status: 'DRAFT',
        publishedAt: null,
      });
    });

    it('answers 200 when it updates the existing draft and when the content does not change', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);
      await put(admin.token, 't1', { content: HTML });

      const updated = await put(admin.token, 't1', { content: '<p>{{program.name}} editado</p>' });
      const repeated = await put(admin.token, 't1', { content: '<p>{{program.name}} editado</p>' });

      expect(updated.status).toBe(200);
      expect(repeated.status).toBe(200);
      expect(templateVersionDtoSchema.parse(repeated.body).content).toBe(
        '<p>{{program.name}} editado</p>',
      );
      expect(repeated.body.updatedAt).toBe(updated.body.updatedAt);
      expect(
        await prisma.templateVersion.count({ where: { templateId: 't1', status: 'DRAFT' } }),
      ).toBe(1);
    });

    it('audits the creation and the update without storing the html', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      await put(admin.token, 't1', { content: HTML });
      await put(admin.token, 't1', { content: '<p>{{program.name}} editado</p>' });

      const audits = await prisma.auditLog.findMany({
        where: { entity: 'TemplateVersion' },
        orderBy: { sequence: 'asc' },
      });
      expect(audits.map((audit) => audit.action)).toEqual(['CREATE', 'UPDATE']);
      expect(audits.every((audit) => audit.actor === admin.user.id)).toBe(true);
      expect(JSON.stringify(audits.map((audit) => [audit.before, audit.after]))).not.toContain(
        'editado',
      );
    });

    it('accepts content of exactly the maximum length', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);
      const prefix = '<p>';
      const suffix = '</p>';
      const content = `${prefix}${'a'.repeat(TEMPLATE_CONTENT_MAX_LENGTH - prefix.length - suffix.length)}${suffix}`;

      const response = await put(admin.token, 't1', { content });

      expect(response.status).toBe(201);
    });
  });

  describe('Validation (400)', () => {
    it.each([
      ['empty content', { content: '' }],
      ['whitespace-only content', { content: '   \n ' }],
      ['content over the limit', { content: 'a'.repeat(TEMPLATE_CONTENT_MAX_LENGTH + 1) }],
      ['missing content', {}],
      ['non-string content', { content: 42 }],
      ['unknown field', { content: HTML, extra: true }],
      ['script tag', { content: '<p>x</p><script>alert(1)</script>' }],
      ['event handler attribute', { content: '<p onclick="x()">x</p>' }],
      ['javascript link', { content: '<a href="javascript:alert(1)">x</a>' }],
      ['external resource', { content: '<img src="https://externo.example/a.png">' }],
      ['unknown variable', { content: '<p>{{variable.desconocida}}</p>' }],
      ['unclosed variable', { content: '<p>{{program.name</p>' }],
    ])('answers 400 for %s and writes nothing', async (_name, body) => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await put(admin.token, 't1', body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.templateVersion.count({ where: { templateId: 't1' } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { entity: 'TemplateVersion' } })).toBe(0);
    });

    it('answers 400 for an id of 65 characters', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await put(admin.token, 't'.repeat(65), { content: HTML });

      expect(response.status).toBe(400);
    });

    it('answers 400, not 500, when the json body exceeds the size limit', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await put(admin.token, 't1', { content: 'a'.repeat(150_000) });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Authentication, authorization and not found', () => {
    it('answers 401 without a token', async () => {
      const response = await request(app).put('/templates/t1/draft').send({ content: HTML });

      expect(response.status).toBe(401);
    });

    it.each([['COMMITTEE_MEMBER'], ['COMMITTEE_PRESIDENT'], ['TEACHER']])(
      'answers 403 for %s, who can only view templates',
      async (role) => {
        await seedTemplate();
        const viewer = await createActor([role]);

        const response = await put(viewer.token, 't1', { content: HTML });

        expect(response.status).toBe(403);
        expect(await prisma.templateVersion.count({ where: { templateId: 't1' } })).toBe(1);
      },
    );

    it('answers 403 for a user without roles', async () => {
      await seedTemplate();
      const outsider = await createActor([]);

      const response = await put(outsider.token, 't1', { content: HTML });

      expect(response.status).toBe(403);
    });

    it('answers 404 for an unknown template', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await put(admin.token, 'does-not-exist', { content: HTML });

      expect(response.status).toBe(404);
    });
  });

  describe('Concurrency (PostgreSQL real, N = 5)', () => {
    it('answers one created and the rest updated under simultaneous first edits', async () => {
      await seedTemplate();
      const admin = await createActor(['ADMINISTRATOR']);

      const responses = await Promise.all(
        Array.from({ length: CONCURRENT_CALLERS }, (_unused, index) =>
          put(admin.token, 't1', { content: `<p>{{program.name}} edición ${index}</p>` }),
        ),
      );

      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([200, 200, 200, 200, 201]);
      expect(
        await prisma.templateVersion.count({ where: { templateId: 't1', status: 'DRAFT' } }),
      ).toBe(1);
      const audits = await prisma.auditLog.findMany({ where: { entity: 'TemplateVersion' } });
      expect(audits.filter((audit) => audit.action === 'CREATE')).toHaveLength(1);
      expect(audits.filter((audit) => audit.action === 'UPDATE')).toHaveLength(
        CONCURRENT_CALLERS - 1,
      );
    }, 20_000);
  });
});
