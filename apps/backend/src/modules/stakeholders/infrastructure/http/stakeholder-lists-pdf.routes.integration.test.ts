import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import type { PdfGenerator } from '../../../../shared/pdf/pdf-generator.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization-fast.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { OFFICIAL_TEMPLATES } from '../../../templates/index.js';

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

describe('GET /stakeholder-lists/:id/pdf (PostgreSQL real, HU-026, T-026-08)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-stakeholder-pdf',
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

  async function seedPublishedFo03() {
    const fo03 = OFFICIAL_TEMPLATES.find((template) => template.code === 'FO-03');
    if (!fo03) {
      throw new Error('FO-03 no encontrado en OFFICIAL_TEMPLATES');
    }

    await prisma.template.create({
      data: {
        id: 'tpl-fo-03',
        code: fo03.code,
        name: fo03.name,
        type: 'ANNEX',
        variables: fo03.variables.map((variable) => ({
          key: variable.key,
          label: variable.label,
        })),
      },
    });

    await prisma.templateVersion.create({
      data: {
        id: 'ver-fo-03-1',
        templateId: 'tpl-fo-03',
        number: 1,
        status: 'PUBLISHED',
        content: fo03.content,
        updatedBy: 'seed',
        publishedBy: 'seed',
        publishedAt: new Date('2026-11-20T10:00:00.000Z'),
      },
    });
  }

  async function seedListsWithMembers() {
    await prisma.program.create({
      data: {
        id: 'prog-epis',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });

    await prisma.stakeholderList.create({
      data: {
        id: 'list-emp-2026',
        programId: 'prog-epis',
        type: 'EMPLOYER',
        year: 2026,
        studyPlanNumber: '2024',
        version: 'v1.0',
        createdBy: 'seed',
      },
    });

    await prisma.stakeholderList.create({
      data: {
        id: 'list-tea-2026',
        programId: 'prog-epis',
        type: 'TEACHER',
        year: 2026,
        studyPlanNumber: '2024',
        version: 'v1.0',
        createdBy: 'seed',
      },
    });

    await prisma.stakeholder.createMany({
      data: [
        {
          id: 'stk-emp-1',
          kind: 'LEGAL_ENTITY',
          fullName: 'Empresa Ficticia SAC',
          institution: 'Empresa Ficticia SAC',
          ruc: '20123456789',
          sector: 'Software',
          email: 'empresa@ejemplo.test',
          mobile: '999888777',
          position: 'Gerente TI',
          status: 'ACTIVE',
          createdBy: 'seed',
        },
        {
          id: 'stk-tea-1',
          kind: 'PERSON',
          dni: '40000001',
          fullName: 'Docente Ficticio',
          email: 'docente@ejemplo.test',
          mobile: '988777666',
          status: 'ACTIVE',
          createdBy: 'seed',
        },
      ],
    });

    await prisma.stakeholderListMember.createMany({
      data: [
        {
          id: 'mem-emp-1',
          listId: 'list-emp-2026',
          stakeholderId: 'stk-emp-1',
          fullName: 'Empresa Ficticia SAC',
          institution: 'Empresa Ficticia SAC',
          ruc: '20123456789',
          sector: 'Software',
          representative: 'Ana Pérez',
          email: 'empresa@ejemplo.test',
          mobile: '999888777',
          position: 'Gerente TI',
          createdBy: 'seed',
        },
        {
          id: 'mem-tea-1',
          listId: 'list-tea-2026',
          stakeholderId: 'stk-tea-1',
          fullName: 'Docente Ficticio',
          email: 'docente@ejemplo.test',
          mobile: '988777666',
          createdBy: 'seed',
        },
      ],
    });
  }

  it('answers 200 with a pdf, the template version header and one DOWNLOAD audit row', async () => {
    await seedPublishedFo03();
    await seedListsWithMembers();
    const actor = await createActor(['Director de Escuela']);

    const response = await request(app)
      .get('/stakeholder-lists/list-emp-2026/pdf')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="fo-03-2026-v1.pdf"',
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-template-version']).toBe('1');

    const bodyText = Buffer.from(response.body).toString('utf8');
    expect(bodyText.startsWith('%PDF-1.4')).toBe(true);
    expect(bodyText).toContain('Empresa Ficticia SAC');
    expect(bodyText).toContain('Docente Ficticio');

    const auditRows = await prisma.auditLog.findMany({
      where: { action: 'DOWNLOAD', entity: 'StakeholderList', entityId: 'list-emp-2026' },
    });
    expect(auditRows).toHaveLength(1);
    const serializedAudit = JSON.stringify(auditRows[0]?.after ?? {});
    expect(serializedAudit).not.toContain('empresa@ejemplo.test');
    expect(serializedAudit).not.toContain('999888777');
    expect(serializedAudit).not.toContain('docente@ejemplo.test');
    expect(serializedAudit).not.toContain('988777666');
    expect(auditRows[0]?.after).toMatchObject({
      templateCode: 'FO-03',
      versionNumber: 1,
      year: 2026,
      requestedType: 'EMPLOYER',
      listCount: 2,
      memberCount: 2,
    });
  }, 5_000);

  it('answers 200 with dashes when optional member fields are null', async () => {
    await seedPublishedFo03();
    await prisma.program.create({
      data: { id: 'prog-epis', code: 'EPIS', name: 'Sistemas', faculty: 'FISME' },
    });
    await prisma.stakeholderList.create({
      data: {
        id: 'list-stu-2026',
        programId: 'prog-epis',
        type: 'STUDENT',
        year: 2026,
        studyPlanNumber: null,
        version: null,
        createdBy: 'seed',
      },
    });
    await prisma.stakeholder.create({
      data: {
        id: 'stk-stu-1',
        kind: 'PERSON',
        dni: '40000002',
        fullName: 'Estudiante Sin Datos',
        status: 'ACTIVE',
        createdBy: 'seed',
      },
    });
    await prisma.stakeholderListMember.create({
      data: {
        id: 'mem-stu-1',
        listId: 'list-stu-2026',
        stakeholderId: 'stk-stu-1',
        fullName: 'Estudiante Sin Datos',
        email: null,
        mobile: null,
        cycle: null,
        createdBy: 'seed',
      },
    });

    const actor = await createActor(['Director de Escuela']);
    const response = await request(app)
      .get('/stakeholder-lists/list-stu-2026/pdf')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(200);
    const bodyText = Buffer.from(response.body).toString('utf8');
    expect(bodyText).toContain('Estudiante Sin Datos');
    expect(bodyText).not.toContain('{{');
  }, 5_000);

  it('answers 400 for an invalid id or unknown query', async () => {
    const actor = await createActor(['Director de Escuela']);

    const oversized = await request(app)
      .get(`/stakeholder-lists/${'a'.repeat(65)}/pdf`)
      .set('Authorization', `Bearer ${actor.token}`);
    expect(oversized.status).toBe(400);

    const unknownQuery = await request(app)
      .get('/stakeholder-lists/list-1/pdf?extra=1')
      .set('Authorization', `Bearer ${actor.token}`);
    expect(unknownQuery.status).toBe(400);
  }, 5_000);

  it('answers 401 without authentication', async () => {
    const response = await request(app).get('/stakeholder-lists/list-1/pdf');
    expect(response.status).toBe(401);
  }, 5_000);

  it('answers 403 without documento.descargar', async () => {
    const actor = await createActor(['Miembro Comité Calidad']);

    const response = await request(app)
      .get('/stakeholder-lists/list-1/pdf')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(403);
  }, 5_000);

  it('answers 404 for an unknown list', async () => {
    await seedPublishedFo03();
    const actor = await createActor(['Director de Escuela']);

    const response = await request(app)
      .get('/stakeholder-lists/list-inexistente/pdf')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(response.status).toBe(404);
  }, 5_000);

  it('answers 409 for a second concurrent download of the same user and records one audit row', async () => {
    await seedPublishedFo03();
    await seedListsWithMembers();
    const actor = await createActor(['Director de Escuela']);

    const deferred = createDeferred<Buffer>();
    renderMock.mockImplementationOnce(() => deferred.promise);

    const firstReq = request(app)
      .get('/stakeholder-lists/list-emp-2026/pdf')
      .set('Authorization', `Bearer ${actor.token}`)
      .then((res) => res);

    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledTimes(1);
    });

    const secondRes = await request(app)
      .get('/stakeholder-lists/list-emp-2026/pdf')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(secondRes.status).toBe(409);

    deferred.resolve(Buffer.from('%PDF-1.4\nConcurrent OK', 'utf8'));
    const firstRes = await firstReq;
    expect(firstRes.status).toBe(200);

    const auditRows = await prisma.auditLog.findMany({
      where: { action: 'DOWNLOAD', entity: 'StakeholderList', entityId: 'list-emp-2026' },
    });
    expect(auditRows).toHaveLength(1);
  }, 5_000);
});
