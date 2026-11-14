import { describe, expect, it } from 'vitest';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { EditTemplateUseCase } from '../../application/edit-template.js';
import { PublishTemplateUseCase } from '../../application/publish-template.js';
import { TemplateDraftChangedError } from '../../domain/errors/index.js';
import type { TemplatePermissionChecker } from '../../domain/ports/template-permission-checker.js';
import { PrismaTemplateRepository } from './prisma-template-repository.js';
import { PrismaTemplateVersionRepository } from './prisma-template-version-repository.js';

const allowAll: TemplatePermissionChecker = { assertAllowed: async () => undefined };
const CONCURRENT_CALLERS = 5;
const OLD = new Date('2026-11-01T10:00:00.000Z');
const DRAFT_AT = new Date('2026-11-05T10:00:00.000Z');

describe('EditTemplateUseCase Integration (PostgreSQL real, T-018-22, RF-018)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const templates = new PrismaTemplateRepository(uow);
  const versions = new PrismaTemplateVersionRepository(uow);
  const shared = {
    templateRepository: templates,
    versionReader: versions,
    versionRepository: versions,
    permissionChecker: allowAll,
    unitOfWork: uow,
    auditLogger: auditServices.auditLogger,
  };
  const edit = new EditTemplateUseCase(shared);
  const publish = new PublishTemplateUseCase(shared);

  async function seedTemplate(withDraft = false) {
    await prisma.template.create({
      data: {
        id: 't1',
        code: 'FO-01',
        name: 'Anexo 1',
        type: 'ANNEX',
        variables: [{ key: 'program.name', label: 'Programa' }],
      },
    });
    await prisma.templateVersion.create({
      data: {
        id: 'v1',
        templateId: 't1',
        number: 1,
        status: 'PUBLISHED',
        content: '<p>contenido de la versión 1</p>',
        publishedAt: OLD,
        publishedBy: 'seed',
        updatedAt: OLD,
      },
    });
    if (withDraft) {
      await prisma.templateVersion.create({
        data: {
          id: 'v2',
          templateId: 't1',
          number: 2,
          status: 'DRAFT',
          content: '<p>{{program.name}} borrador</p>',
          updatedAt: DRAFT_AT,
        },
      });
    }
  }

  it('creates the draft as the next number and keeps the published version untouched', async () => {
    await seedTemplate();

    const result = await edit.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<p>{{program.name}} nuevo</p>',
    });

    expect(result.created).toBe(true);
    expect(result.version).toMatchObject({ number: 2, status: 'DRAFT', publishedAt: null });
    expect((await versions.findById('v1'))?.content).toBe('<p>contenido de la versión 1</p>');
    const audits = await prisma.auditLog.findMany({ where: { entity: 'TemplateVersion' } });
    expect(audits.map((audit) => audit.action)).toEqual(['CREATE']);
    expect(JSON.stringify(audits.map((audit) => [audit.before, audit.after]))).not.toContain(
      'nuevo',
    );
  }, 20_000);

  it('updates the existing draft, audits an UPDATE and answers idempotently on identical content', async () => {
    await seedTemplate(true);

    const changed = await edit.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<p>{{program.name}} editado</p>',
    });
    const repeated = await edit.execute({
      actorId: 'user-1',
      templateId: 't1',
      content: '<p>{{program.name}} editado</p>',
    });

    expect(changed.created).toBe(false);
    expect(repeated.created).toBe(false);
    expect(repeated.version.updatedAt).toBe(changed.version.updatedAt);
    expect(
      await prisma.templateVersion.count({ where: { templateId: 't1', status: 'DRAFT' } }),
    ).toBe(1);
    const audits = await prisma.auditLog.findMany({ where: { entity: 'TemplateVersion' } });
    expect(audits.map((audit) => audit.action)).toEqual(['UPDATE']);
  }, 20_000);

  it('creates exactly one draft under N simultaneous first edits', async () => {
    await seedTemplate();

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_CALLERS }, (_unused, index) =>
        edit.execute({
          actorId: `user-${index}`,
          templateId: 't1',
          content: `<p>{{program.name}} edición ${index}</p>`,
        }),
      ),
    );

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    const outcomes = results.map(
      (result) => (result as PromiseFulfilledResult<{ created: boolean }>).value,
    );
    expect(outcomes.filter((outcome) => outcome.created)).toHaveLength(1);
    expect(
      await prisma.templateVersion.count({ where: { templateId: 't1', status: 'DRAFT' } }),
    ).toBe(1);
    const audits = await prisma.auditLog.findMany({ where: { entity: 'TemplateVersion' } });
    expect(audits.filter((audit) => audit.action === 'CREATE')).toHaveLength(1);
    expect(audits.filter((audit) => audit.action === 'UPDATE')).toHaveLength(
      CONCURRENT_CALLERS - 1,
    );
  }, 20_000);

  it('serializes an edit and a publication of the same template', async () => {
    await seedTemplate(true);

    const [edited, published] = await Promise.allSettled([
      edit.execute({
        actorId: 'user-1',
        templateId: 't1',
        content: '<p>{{program.name}} cambio simultáneo</p>',
      }),
      publish.execute({
        actorId: 'user-2',
        templateId: 't1',
        versionId: 'v2',
        expectedUpdatedAt: DRAFT_AT.toISOString(),
      }),
    ]);

    const draft = await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v2' } });
    if (published.status === 'fulfilled') {
      // Publicó primero: v2 queda con el contenido revisado y la edición abre una versión nueva.
      expect(draft.status).toBe('PUBLISHED');
      expect(draft.content).toBe('<p>{{program.name}} borrador</p>');
      expect(edited.status).toBe('fulfilled');
      const next = await prisma.templateVersion.findFirstOrThrow({ where: { number: 3 } });
      expect(next.status).toBe('DRAFT');
      expect(next.content).toBe('<p>{{program.name}} cambio simultáneo</p>');
    } else {
      // Editó primero: el contenido cambió y la publicación se rechaza sin publicar nada.
      expect(published.reason).toBeInstanceOf(TemplateDraftChangedError);
      expect(draft.status).toBe('DRAFT');
      expect(draft.content).toBe('<p>{{program.name}} cambio simultáneo</p>');
      expect((await versions.findById('v1'))?.status).toBe('PUBLISHED');
    }
    expect(
      await prisma.templateVersion.count({ where: { templateId: 't1', status: 'PUBLISHED' } }),
    ).toBe(1);
  }, 20_000);
});
