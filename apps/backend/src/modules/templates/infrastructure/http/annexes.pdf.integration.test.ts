import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
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

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('GET /annexes/:code/pdf (PostgreSQL real, HU-070, T-070-10, RF-070, RNF-009)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-annexes-pdf-test',
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

  async function seedAnnex(options?: {
    id?: string;
    code?: string;
    publishedVersionNumber?: number;
  }) {
    const id = options?.id ?? 'tpl-annex-1';
    const code = options?.code ?? 'FO-01';

    await prisma.template.create({
      data: {
        id,
        code,
        name: 'Anexo 1. Cronograma',
        type: 'ANNEX',
        variables: [
          { key: 'logo.url', label: 'Escudo' },
          { key: 'schedule.period', label: 'Periodo' },
          { key: 'activities.name', label: 'Actividad' },
        ],
      },
    });

    if (options?.publishedVersionNumber !== undefined) {
      await prisma.templateVersion.create({
        data: {
          id: `ver-${id}`,
          templateId: id,
          number: options.publishedVersionNumber,
          status: 'PUBLISHED',
          content:
            '<header><img src="{{logo.url}}" /></header><p>{{schedule.period}}</p><table><tr data-repeat="activities"><td>{{activities.name}}</td></tr></table>',
          updatedBy: 'seed',
          publishedBy: 'seed',
          publishedAt: new Date('2026-11-20T12:00:00.000Z'),
        },
      });
    } else {
      await prisma.templateVersion.create({
        data: {
          id: `ver-draft-${id}`,
          templateId: id,
          number: 1,
          status: 'DRAFT',
          content: '<p>Solo borrador</p>',
          updatedBy: 'seed',
        },
      });
    }
  }

  it('answers 200 with a pdf and the template version in the headers', async () => {
    await seedAnnex({ publishedVersionNumber: 2 });
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .get('/annexes/FO-01/pdf')
      .set('Authorization', `Bearer ${admin.token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe('attachment; filename="fo-01-v2.pdf"');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-template-version']).toBe('2');

    const bodyText = (response.body as Buffer).toString('utf8');
    expect(bodyText.startsWith('%PDF-1.4')).toBe(true);
    expect(bodyText).toContain('<p>(sin periodo definido)</p>');
    expect(bodyText).not.toContain('{{');
  });

  it('records the download in the audit table in the same request', async () => {
    await seedAnnex({ publishedVersionNumber: 3 });
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .get('/annexes/FO-01/pdf')
      .set('Authorization', `Bearer ${admin.token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    const expectedHash = createHash('sha256')
      .update(response.body as Buffer)
      .digest('hex');

    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        action: 'DOWNLOAD',
        entity: 'TemplateVersion',
        entityId: 'ver-tpl-annex-1',
      },
      orderBy: { occurredAt: 'desc' },
    });

    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.actor).toBe(admin.user.id);
    expect(auditEntry?.after).toMatchObject({
      templateId: 'tpl-annex-1',
      templateCode: 'FO-01',
      versionId: 'ver-tpl-annex-1',
      versionNumber: 3,
      pdfSha256: expectedHash,
      pdfBytes: (response.body as Buffer).byteLength,
    });
  });

  it('rejects out-of-range and malformed annex codes with 400', async () => {
    const admin = await createActor(['ADMINISTRATOR']);

    for (const invalidCode of ['FO-12', 'fo-01', `FO-${'1'.repeat(62)}`]) {
      const response = await request(app)
        .get(`/annexes/${invalidCode}/pdf`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(response.status).toBe(400);
    }
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/annexes/FO-01/pdf');
    expect(response.status).toBe(401);
  });

  it('rejects users without documento.descargar permission with 403', async () => {
    await seedAnnex({ publishedVersionNumber: 1 });
    const teacher = await createActor(['TEACHER']);

    const response = await request(app)
      .get('/annexes/FO-01/pdf')
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(response.status).toBe(403);
  });

  it('answers 404 when the annex has no published version', async () => {
    await seedAnnex();
    const admin = await createActor(['ADMINISTRATOR']);

    const response = await request(app)
      .get('/annexes/FO-01/pdf')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(response.status).toBe(404);
  });

  it('answers 409 to a second simultaneous download from the same user', async () => {
    await seedAnnex({ publishedVersionNumber: 1 });
    const admin = await createActor(['ADMINISTRATOR']);
    const gate = createDeferred<Buffer>();

    renderMock.mockImplementationOnce(() => gate.promise);

    const firstReq = request(app)
      .get('/annexes/FO-01/pdf')
      .set('Authorization', `Bearer ${admin.token}`)
      .then((res) => res);

    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledTimes(1);
    });

    const secondRes = await request(app)
      .get('/annexes/FO-01/pdf')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(secondRes.status).toBe(409);

    gate.resolve(Buffer.from('%PDF-1.4\nGate resolved', 'utf8'));
    const firstRes = await firstReq;
    expect(firstRes.status).toBe(200);
  });
});
