import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { listTemplatesResponseSchema, templateDetailDtoSchema } from '@sigoa/shared';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { seedTemplateDefaults } from '../prisma/seed/template-seed.js';

const PUBLISHED_AT = new Date('2026-11-01T10:00:00.000Z');

describe('GET /templates (PostgreSQL real, HU-018, T-018-26, RF-018, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-templates-list-test',
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

  const list = (token: string, query = '') =>
    request(app).get(`/templates${query}`).set('Authorization', `Bearer ${token}`);

  const detail = (token: string, id: string) =>
    request(app).get(`/templates/${id}`).set('Authorization', `Bearer ${token}`);

  async function seedVersions(
    templateId: string,
    statuses: Array<'OBSOLETE' | 'PUBLISHED' | 'DRAFT'>,
  ) {
    let number = 0;
    for (const status of statuses) {
      number += 1;
      await prisma.templateVersion.create({
        data: {
          id: `${templateId}-v${number}`,
          templateId,
          number,
          status,
          content: `<p>versión ${number}</p>`,
          publishedAt: status === 'DRAFT' ? null : PUBLISHED_AT,
          publishedBy: status === 'DRAFT' ? null : 'seed',
        },
      });
    }
  }

  describe('GET /templates', () => {
    it('lists the seeded official templates with their published version', async () => {
      await seedTemplateDefaults(prisma);
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await list(admin.token);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const page = listTemplatesResponseSchema.parse(response.body);
      expect(page).toMatchObject({ page: 1, pageSize: 50, total: 20, totalPages: 1 });
      expect(page.items).toHaveLength(20);
      for (const item of page.items) {
        expect(item.published, item.code).toMatchObject({ number: 1, status: 'PUBLISHED' });
        expect(item.draft, item.code).toBeNull();
      }
      const codes = page.items.map((item) => item.code);
      expect(codes).toEqual([...codes].sort());
      for (const code of ['FO-01', 'FO-11', 'ACTA', 'ENC-A5', 'ENC-A6', 'ENC-A9', 'ENC-A10']) {
        expect(codes).toContain(code);
      }
      expect(page.items.filter((item) => item.type === 'ANNEX')).toHaveLength(11);
      expect(page.items.filter((item) => item.type === 'INSTRUMENT')).toHaveLength(4);
    }, 30_000);

    it('shows the draft next to the published version', async () => {
      await seedTemplateDefaults(prisma);
      const fo01 = await prisma.template.findUniqueOrThrow({ where: { code: 'FO-01' } });
      await prisma.templateVersion.create({
        data: { templateId: fo01.id, number: 2, content: '<p>borrador</p>' },
      });
      const admin = await createActor(['ADMINISTRATOR']);

      const page = listTemplatesResponseSchema.parse((await list(admin.token, '?type=ANNEX')).body);

      const item = page.items.find((candidate) => candidate.code === 'FO-01');
      expect(item?.published?.number).toBe(1);
      expect(item?.draft).toMatchObject({ number: 2, status: 'DRAFT', publishedAt: null });
    }, 30_000);

    it('returns a template without versions with null published and draft (incomplete but valid)', async () => {
      await prisma.template.create({
        data: { id: 't1', code: 'FO-99', name: 'Sin versiones', type: 'ANNEX' },
      });
      const admin = await createActor(['ADMINISTRATOR']);

      const page = listTemplatesResponseSchema.parse((await list(admin.token)).body);

      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        code: 'FO-99',
        published: null,
        draft: null,
        variables: [],
      });
    });

    it('filters by type and paginates keeping the total', async () => {
      await seedTemplateDefaults(prisma);
      const admin = await createActor(['ADMINISTRATOR']);

      const surveys = listTemplatesResponseSchema.parse(
        (await list(admin.token, '?type=SURVEY')).body,
      );
      const second = listTemplatesResponseSchema.parse(
        (await list(admin.token, '?page=2&pageSize=8')).body,
      );
      const beyond = listTemplatesResponseSchema.parse(
        (await list(admin.token, '?page=9&pageSize=8')).body,
      );

      expect(surveys.items.map((item) => item.code)).toEqual([
        'ENC-A10',
        'ENC-A5',
        'ENC-A6',
        'ENC-A9',
      ]);
      expect(surveys.total).toBe(4);
      expect(second).toMatchObject({ page: 2, pageSize: 8, total: 20, totalPages: 3 });
      expect(second.items).toHaveLength(8);
      expect(beyond.items).toEqual([]);
      expect(beyond.total).toBe(20);
    }, 30_000);

    it('answers an empty list when there are no templates', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await list(admin.token);

      expect(response.status).toBe(200);
      expect(listTemplatesResponseSchema.parse(response.body)).toEqual({
        items: [],
        page: 1,
        pageSize: 50,
        total: 0,
        totalPages: 0,
      });
    });

    it('lets roles with view permission read the list', async () => {
      await seedTemplateDefaults(prisma);
      const member = await createActor(['COMMITTEE_MEMBER']);

      const response = await list(member.token);

      expect(response.status).toBe(200);
      expect(listTemplatesResponseSchema.parse(response.body).total).toBe(20);
    }, 30_000);

    it.each([
      ['pageSize over the limit', '?pageSize=101'],
      ['page zero', '?page=0'],
      ['page over the limit', '?page=10001'],
      ['fractional page', '?page=1.5'],
      ['invalid type', '?type=OTHER'],
      ['unknown key', '?foo=bar'],
    ])('answers 400 for %s', async (_name, query) => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await list(admin.token, query);

      expect(response.status).toBe(400);
    });

    it('answers 401 without a token', async () => {
      const response = await request(app).get('/templates');

      expect(response.status).toBe(401);
    });

    it('answers 403 for a user without the view permission', async () => {
      await seedTemplateDefaults(prisma);
      const outsider = await createActor([]);

      const response = await list(outsider.token);

      expect(response.status).toBe(403);
    }, 30_000);
  });

  describe('GET /templates/:id', () => {
    it('returns the detail with the history and the content of the published version and the draft', async () => {
      await prisma.template.create({
        data: {
          id: 't1',
          code: 'FO-99',
          name: 'Con historial',
          type: 'ANNEX',
          variables: [{ key: 'program.name', label: 'Programa' }],
        },
      });
      await seedVersions('t1', ['OBSOLETE', 'PUBLISHED', 'DRAFT']);
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await detail(admin.token, 't1');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = templateDetailDtoSchema.parse(response.body);
      expect(body.versions.map((version) => version.number)).toEqual([3, 2, 1]);
      expect(body.published).toMatchObject({ number: 2, content: '<p>versión 2</p>' });
      expect(body.draft).toMatchObject({
        number: 3,
        content: '<p>versión 3</p>',
        publishedAt: null,
      });
      expect(body.variables).toEqual([{ key: 'program.name', label: 'Programa' }]);
    });

    it('returns a template without versions (incomplete but valid)', async () => {
      await prisma.template.create({
        data: { id: 't1', code: 'FO-99', name: 'Sin versiones', type: 'ANNEX' },
      });
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await detail(admin.token, 't1');

      expect(templateDetailDtoSchema.parse(response.body)).toMatchObject({
        versions: [],
        published: null,
        draft: null,
      });
    });

    it('returns a seeded template with its version 1 content', async () => {
      await seedTemplateDefaults(prisma);
      const fo01 = await prisma.template.findUniqueOrThrow({ where: { code: 'FO-01' } });
      const teacher = await createActor(['TEACHER']);

      const response = await detail(teacher.token, fo01.id);

      const body = templateDetailDtoSchema.parse(response.body);
      expect(body.published?.number).toBe(1);
      expect(body.published?.content).toContain(
        'Universidad Nacional Toribio Rodríguez de Mendoza',
      );
    }, 30_000);

    it('answers 404 for an unknown template', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await detail(admin.token, 'does-not-exist');

      expect(response.status).toBe(404);
    });

    it('answers 400 for an id of 65 characters', async () => {
      const admin = await createActor(['ADMINISTRATOR']);

      const response = await detail(admin.token, 't'.repeat(65));

      expect(response.status).toBe(400);
    });

    it('answers 401 without a token', async () => {
      const response = await request(app).get('/templates/t1');

      expect(response.status).toBe(401);
    });

    it('answers 403 for a user without the view permission', async () => {
      await prisma.template.create({
        data: { id: 't1', code: 'FO-99', name: 'Sin versiones', type: 'ANNEX' },
      });
      const outsider = await createActor([]);

      const response = await detail(outsider.token, 't1');

      expect(response.status).toBe(403);
    });
  });
});
