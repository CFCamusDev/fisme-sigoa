import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Template } from '../domain/entities/template.js';
import { TemplateVersion } from '../domain/entities/template-version.js';
import {
  InvalidTemplateDataError,
  InvalidTemplateTransitionError,
  TemplateDraftChangedError,
  TemplateNotFoundError,
  TemplateVersionNotFoundError,
} from '../domain/errors/index.js';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateRepository } from '../domain/ports/template-repository.js';
import type { TemplateVersionReader } from '../domain/ports/template-version-reader.js';
import type { TemplateVersionRepository } from '../domain/ports/template-version-repository.js';
import { PublishTemplateUseCase } from './publish-template.js';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const REVIEWED = new Date('2026-11-12T12:00:00.000Z');
const FIRST = new Date('2026-11-01T12:00:00.000Z');

const template = Template.create({
  id: 't1',
  code: 'FO-01',
  name: 'Anexo 1',
  type: 'ANNEX',
  variables: [{ key: 'program.name', label: 'Programa' }],
});

function version(
  id: string,
  number: number,
  content: string,
  status: 'DRAFT' | 'PUBLISHED' | 'OBSOLETE',
  at: Date,
  templateId = 't1',
): TemplateVersion {
  const draft = TemplateVersion.createDraft({ id, templateId, number, content, now: at });
  if (status === 'DRAFT') return draft;
  const published = draft.publish({ actorId: 'seed', now: at });
  return status === 'PUBLISHED' ? published : published.markObsolete({ actorId: 'seed', now: at });
}

const command = {
  actorId: 'user-1',
  ip: '10.0.0.1',
  templateId: 't1',
  versionId: 'd2',
  expectedUpdatedAt: REVIEWED.toISOString(),
};

describe('PublishTemplateUseCase (T-018-22, RF-018, RS-020, RS-024)', () => {
  let templateRepository: MockProxy<TemplateRepository>;
  let versionReader: MockProxy<TemplateVersionReader>;
  let versionRepository: MockProxy<TemplateVersionRepository>;
  let permissionChecker: MockProxy<TemplatePermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: PublishTemplateUseCase;

  const previous = version('p1', 1, '<p>versión 1</p>', 'PUBLISHED', FIRST);
  const draft = version('d2', 2, '<p>{{program.name}}</p>', 'DRAFT', REVIEWED);

  beforeEach(() => {
    templateRepository = mock<TemplateRepository>();
    versionReader = mock<TemplateVersionReader>();
    versionRepository = mock<TemplateVersionRepository>();
    permissionChecker = mock<TemplatePermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => await work());
    templateRepository.lockForUpdate.mockResolvedValue(template);
    versionReader.findById.mockResolvedValue(draft);
    versionReader.findPublished.mockResolvedValue(previous);
    versionRepository.transitionStatus.mockResolvedValue(true);
    useCase = new PublishTemplateUseCase({
      templateRepository,
      versionReader,
      versionRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      clock: () => NOW,
    });
  });

  it('marks the previous published version as obsolete and publishes the draft, in that order', async () => {
    const result = await useCase.execute(command);

    expect(result).toMatchObject({
      id: 'd2',
      number: 2,
      status: 'PUBLISHED',
      publishedAt: NOW.toISOString(),
    });
    expect(versionRepository.transitionStatus.mock.calls).toEqual([
      ['p1', 'PUBLISHED', 'OBSOLETE', 'user-1', NOW],
      ['d2', 'DRAFT', 'PUBLISHED', 'user-1', NOW],
    ]);
    const [first, second] = versionRepository.transitionStatus.mock.invocationCallOrder;
    expect(first).toBeLessThan(second!);
  });

  it('audits both transitions with before and after and no HTML', async () => {
    await useCase.execute(command);

    expect(auditLogger.log).toHaveBeenCalledTimes(2);
    const [obsoleteEvent, publishEvent] = auditLogger.log.mock.calls.map((call) => call[0]);
    expect(obsoleteEvent).toMatchObject({
      action: 'STATE_CHANGE',
      entity: 'TemplateVersion',
      entityId: 'p1',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: { number: 1, status: 'PUBLISHED' },
      after: { number: 1, status: 'OBSOLETE' },
    });
    expect(publishEvent).toMatchObject({
      action: 'STATE_CHANGE',
      entityId: 'd2',
      before: { number: 2, status: 'DRAFT' },
      after: { number: 2, status: 'PUBLISHED' },
    });
    expect(JSON.stringify([obsoleteEvent, publishEvent])).not.toContain('{{program.name}}');
  });

  it('publishes the first version without obsoleting anything and audits once', async () => {
    versionReader.findPublished.mockResolvedValue(null);

    const result = await useCase.execute(command);

    expect(result.status).toBe('PUBLISHED');
    expect(versionRepository.transitionStatus).toHaveBeenCalledTimes(1);
    expect(versionRepository.transitionStatus).toHaveBeenCalledWith(
      'd2',
      'DRAFT',
      'PUBLISHED',
      'user-1',
      NOW,
    );
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
  });

  it('never rewrites the content of the previous version', async () => {
    await useCase.execute(command);

    expect(versionRepository.updateDraftContent).not.toHaveBeenCalled();
    expect(versionRepository.saveDraft).not.toHaveBeenCalled();
    const touched = versionRepository.transitionStatus.mock.calls.map((call) => call[0]);
    expect(touched).toEqual(['p1', 'd2']);
  });

  it('locks the template before reading the versions', async () => {
    await useCase.execute(command);

    expect(templateRepository.lockForUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      versionReader.findById.mock.invocationCallOrder[0]!,
    );
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
  });

  it('denies without the permission and touches nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute(command)).rejects.toThrow(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'plantilla.publicar',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('reports a missing template as 404', async () => {
    templateRepository.lockForUpdate.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toThrow(TemplateNotFoundError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('reports a missing version as 404', async () => {
    versionReader.findById.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toThrow(TemplateVersionNotFoundError);

    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
  });

  it('reports a version of another template as 404', async () => {
    versionReader.findById.mockResolvedValue(version('d9', 1, '<p>x</p>', 'DRAFT', REVIEWED, 't2'));

    await expect(useCase.execute({ ...command, versionId: 'd9' })).rejects.toThrow(
      TemplateVersionNotFoundError,
    );
  });

  it.each(['PUBLISHED', 'OBSOLETE'] as const)(
    'answers 409 without changes or audit when the version is already %s (single use)',
    async (status) => {
      versionReader.findById.mockResolvedValue(version('d2', 2, '<p>x</p>', status, REVIEWED));

      await expect(useCase.execute(command)).rejects.toThrow(InvalidTemplateTransitionError);

      expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    },
  );

  it('answers 409 when the draft changed after the administrator reviewed it', async () => {
    versionReader.findById.mockResolvedValue(
      version('d2', 2, '<p>{{program.name}} editado</p>', 'DRAFT', NOW),
    );

    await expect(useCase.execute(command)).rejects.toThrow(TemplateDraftChangedError);

    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('revalidates the content and rejects a draft that is no longer valid', async () => {
    versionReader.findById.mockResolvedValue(
      version('d2', 2, '<p>{{variable.retirada}}</p>', 'DRAFT', REVIEWED),
    );

    await expect(useCase.execute(command)).rejects.toThrow(InvalidTemplateDataError);

    expect(versionRepository.transitionStatus).not.toHaveBeenCalled();
  });

  it('fails with 409 and no audit of the draft when obsoleting the previous one affects 0 rows', async () => {
    versionRepository.transitionStatus.mockResolvedValueOnce(false);

    await expect(useCase.execute(command)).rejects.toThrow(InvalidTemplateTransitionError);

    expect(versionRepository.transitionStatus).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('fails with 409 and no audit of the draft when publishing affects 0 rows', async () => {
    versionRepository.transitionStatus.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(useCase.execute(command)).rejects.toThrow(InvalidTemplateTransitionError);

    // La transacción se revierte entera: la auditoría de la anterior no sobrevive al error.
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
  });
});
