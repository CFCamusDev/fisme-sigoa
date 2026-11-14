import { describe, expect, it } from 'vitest';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PublishTemplateUseCase } from '../../application/publish-template.js';
import {
  InvalidTemplateDataError,
  InvalidTemplateTransitionError,
  TemplateDraftChangedError,
} from '../../domain/errors/index.js';
import type { TemplatePermissionChecker } from '../../domain/ports/template-permission-checker.js';
import { PrismaTemplateRepository } from './prisma-template-repository.js';
import { PrismaTemplateVersionRepository } from './prisma-template-version-repository.js';

const allowAll: TemplatePermissionChecker = { assertAllowed: async () => undefined };
const CONCURRENT_CALLERS = 5;
const OLD = new Date('2026-11-01T10:00:00.000Z');
const DRAFT_AT = new Date('2026-11-05T10:00:00.000Z');

describe('PublishTemplateUseCase Integration (PostgreSQL real, T-018-22, RF-018)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const templates = new PrismaTemplateRepository(uow);
  const versions = new PrismaTemplateVersionRepository(uow);

  const useCase = new PublishTemplateUseCase({
    templateRepository: templates,
    versionReader: versions,
    versionRepository: versions,
    permissionChecker: allowAll,
    unitOfWork: uow,
    auditLogger: auditServices.auditLogger,
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
          publishedAt: OLD,
          publishedBy: 'seed',
          updatedAt: OLD,
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

  const command = {
    actorId: 'user-1',
    templateId: 't1',
    versionId: 'v2',
    expectedUpdatedAt: DRAFT_AT.toISOString(),
  };

  it('marks the previous published version as obsolete and publishes the draft with two audits', async () => {
    await seedTemplate();

    const result = await useCase.execute(command);

    expect(result.status).toBe('PUBLISHED');
    expect((await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v1' } })).status).toBe(
      'OBSOLETE',
    );
    const published = await prisma.templateVersion.findUniqueOrThrow({ where: { id: 'v2' } });
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedBy).toBe('user-1');
    expect(published.publishedAt).not.toBeNull();
    const audits = await prisma.auditLog.findMany({
      where: { entity: 'TemplateVersion' },
      orderBy: { sequence: 'asc' },
    });
    expect(audits.map((audit) => [audit.entityId, audit.action])).toEqual([
      ['v1', 'STATE_CHANGE'],
      ['v2', 'STATE_CHANGE'],
    ]);
  }, 20_000);

  it('never rewrites the content of the previous version', async () => {
    await seedTemplate();

    await useCase.execute(command);

    const first = await versions.findById('v1');
    expect(first?.content).toBe('<p>contenido de la versión 1</p>');
    expect(first?.publishedAt).toEqual(OLD);
    expect(first?.publishedBy).toBe('seed');
    expect((await versions.findPublished('t1'))?.id).toBe('v2');
  }, 20_000);

  it('publishes the first version with a single audit', async () => {
    await seedTemplate(false);

    await useCase.execute(command);

    expect(await prisma.auditLog.count({ where: { entity: 'TemplateVersion' } })).toBe(1);
  }, 20_000);

  it('answers 409 and changes nothing when the draft changed after it was reviewed', async () => {
    await seedTemplate();

    await expect(
      useCase.execute({ ...command, expectedUpdatedAt: OLD.toISOString() }),
    ).rejects.toThrow(TemplateDraftChangedError);

    expect((await versions.findById('v2'))?.status).toBe('DRAFT');
    expect((await versions.findById('v1'))?.status).toBe('PUBLISHED');
    expect(await prisma.auditLog.count({ where: { entity: 'TemplateVersion' } })).toBe(0);
  }, 20_000);

  it('rolls back the obsolescence and the audit when the draft content is invalid', async () => {
    await seedTemplate(true, '<p>x</p><script>alert(1)</script>');

    await expect(useCase.execute(command)).rejects.toThrow(InvalidTemplateDataError);

    expect((await versions.findById('v1'))?.status).toBe('PUBLISHED');
    expect((await versions.findById('v2'))?.status).toBe('DRAFT');
    expect(await prisma.auditLog.count({ where: { entity: 'TemplateVersion' } })).toBe(0);
  }, 20_000);

  it('answers 409 when the same draft is published a second time', async () => {
    await seedTemplate();
    await useCase.execute(command);

    await expect(useCase.execute(command)).rejects.toThrow(InvalidTemplateTransitionError);

    expect(await prisma.auditLog.count({ where: { entity: 'TemplateVersion' } })).toBe(2);
  }, 20_000);

  it('lets exactly one of N simultaneous publications win', async () => {
    await seedTemplate();

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_CALLERS }, () => useCase.execute(command)),
    );

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(CONCURRENT_CALLERS - 1);
    for (const failure of rejected) {
      expect(failure.reason).toBeInstanceOf(InvalidTemplateTransitionError);
    }
    expect(
      await prisma.templateVersion.count({ where: { templateId: 't1', status: 'PUBLISHED' } }),
    ).toBe(1);
    expect((await versions.findById('v1'))?.status).toBe('OBSOLETE');
    const audits = await prisma.auditLog.findMany({ where: { entity: 'TemplateVersion' } });
    expect(audits).toHaveLength(2);
    expect(audits.every((audit) => audit.action === 'STATE_CHANGE')).toBe(true);
  }, 20_000);
});
