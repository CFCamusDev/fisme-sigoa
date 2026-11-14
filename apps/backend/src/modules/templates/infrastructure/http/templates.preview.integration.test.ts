import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { TEMPLATE_CONTENT_MAX_LENGTH, previewTemplateResponseSchema } from '@sigoa/shared';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import type { PdfGenerator } from '../../../../shared/pdf/pdf-generator.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';

describe('POST /templates/:id/preview (PostgreSQL real, HU-019, T-019-10, RF-019, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-templates-preview-test',
  });

  const emailSender = new InMemoryEmailSender();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);

  const renderMock = vi.fn<PdfGenerator['render']>(async ({ html }) =>
    Buffer.from(`%PDF-1.4\n${html}`, 'utf8'),
  );
  const pdfGenerator: PdfGenerator = {
    render: renderMock,
    close: async () => {},
  };

  const app = createApp({
    env,
    setupRoutes: (instance) => {
      setupAppRoutes(instance, {
        unitOfWork: uow,
        auditLogger: auditServices.auditLogger,
        dbProvider: uow,
        env,
        emailSender,
        pdfGenerator,
      });
    },
  });

  beforeEach(async () => {
    emailSender.clear();
    renderMock.mockClear();
    renderMock.mockImplementation(async ({ html }) => Buffer.from(`%PDF-1.4\n${html}`, 'utf8'));
    await seedAuthorizationFast(prisma);
  });

  const createActor = (roles: string[]) =>
    createAuthenticatedActor({ prisma, jwtSecret: env.AUTH_JWT_SECRET, roles });

  const post = (token: string, id: string, body: unknown) =>
    request(app)
      .post(`/templates/${id}/preview`)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  async function seedTemplate(
    id = 't1',
    variables: { key: string; label: string }[] = [{ key: 'program.name', label: 'Programa' }],
  ) {
    await prisma.template.create({
      data: {
        id,
        code: `FO-${id}`,
        name: 'Anexo 1',
        type: 'ANNEX',
        variables,
      },
    });
    await prisma.templateVersion.create({
      data: {
        id: `v-${id}`,
        templateId: id,
        number: 1,
        status: 'DRAFT',
        content: '<p>borrador</p>',
        updatedBy: 'seed',
      },
    });
  }

  it('answers 200 with a pdf for a draft template', async () => {
    await seedTemplate();
    const admin = await createActor(['ADMINISTRADOR']);

    const response = await post(admin.accessToken, 't1', {
      content: '<p>{{program.name}}</p>',
    });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const parsed = previewTemplateResponseSchema.parse(response.body);
    expect(parsed.warnings).toEqual([]);
    const decoded = Buffer.from(parsed.pdfBase64, 'base64').toString('utf8');
    expect(decoded).toContain('%PDF-1.4');
    expect(decoded).toContain('<p>Programa (ejemplo)</p>');
  });

  it('reports unrecognized variables as warnings', async () => {
    await seedTemplate();
    const admin = await createActor(['ADMINISTRADOR']);

    const response = await post(admin.accessToken, 't1', {
      content: '<p>{{program.name}} {{missing.field}}</p>',
    });

    expect(response.status).toBe(200);
    const parsed = previewTemplateResponseSchema.parse(response.body);
    expect(parsed.warnings).toEqual([{ variable: 'missing.field' }]);
    const decoded = Buffer.from(parsed.pdfBase64, 'base64').toString('utf8');
    expect(decoded).toContain('{{missing.field}}');
  });

  it('accepts incomplete but valid input for a template without variables and plain text content', async () => {
    await seedTemplate('t-plain', []);
    const admin = await createActor(['ADMINISTRADOR']);

    const response = await post(admin.accessToken, 't-plain', {
      content: '<p>Contenido fijo sin variables</p>',
    });

    expect(response.status).toBe(200);
    const parsed = previewTemplateResponseSchema.parse(response.body);
    expect(parsed.warnings).toEqual([]);
  });

  it('rejects out-of-bounds payloads and unknown fields with 400', async () => {
    await seedTemplate();
    const admin = await createActor(['ADMINISTRADOR']);

    const tooLong = await post(admin.accessToken, 't1', {
      content: 'a'.repeat(TEMPLATE_CONTENT_MAX_LENGTH + 1),
    });
    expect(tooLong.status).toBe(400);

    const empty = await post(admin.accessToken, 't1', { content: '   ' });
    expect(empty.status).toBe(400);

    const unknownField = await post(admin.accessToken, 't1', {
      content: '<p>ok</p>',
      extra: true,
    });
    expect(unknownField.status).toBe(400);

    const longId = await post(admin.accessToken, 'a'.repeat(65), { content: '<p>ok</p>' });
    expect(longId.status).toBe(400);
  });

  it('rejects unsafe html with 400', async () => {
    await seedTemplate();
    const admin = await createActor(['ADMINISTRADOR']);

    const response = await post(admin.accessToken, 't1', {
      content: '<p>hola</p><script>alert(1)</script>',
    });

    expect(response.status).toBe(400);
    expect(renderMock).not.toHaveBeenCalled();
  });

  it('answers 401 without session and 403 without plantilla.editar permission', async () => {
    await seedTemplate();

    const unauthenticated = await request(app)
      .post('/templates/t1/preview')
      .send({ content: '<p>ok</p>' });
    expect(unauthenticated.status).toBe(401);

    const readerOnly = await createActor(['PRESIDENTE_COMITE']);
    const forbidden = await post(readerOnly.accessToken, 't1', { content: '<p>ok</p>' });
    expect(forbidden.status).toBe(403);
  });

  it('answers 404 for an unknown template', async () => {
    const admin = await createActor(['ADMINISTRADOR']);
    const response = await post(admin.accessToken, 'non-existent', {
      content: '<p>ok</p>',
    });

    expect(response.status).toBe(404);
  });

  it('answers 409 to a second simultaneous preview from the same user', async () => {
    await seedTemplate();
    const admin = await createActor(['ADMINISTRADOR']);

    let releaseFirst!: () => void;
    renderMock.mockImplementationOnce(
      ({ html }) =>
        new Promise<Buffer>((resolve) => {
          releaseFirst = () => resolve(Buffer.from(`%PDF-1.4\n${html}`, 'utf8'));
        }),
    );

    const firstPromise = post(admin.accessToken, 't1', {
      content: '<p>{{program.name}}</p>',
    }).then((res) => res);

    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledTimes(1);
    });

    const secondResponse = await post(admin.accessToken, 't1', {
      content: '<p>{{program.name}}</p>',
    });
    expect(secondResponse.status).toBe(409);

    releaseFirst();
    const firstResponse = await firstPromise;
    expect(firstResponse.status).toBe(200);
  });
});
