import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { Template } from '../domain/entities/template.js';
import { TemplateVersion } from '../domain/entities/template-version.js';
import {
  InvalidTemplateDataError,
  TemplateDraftExistsError,
  TemplateNotFoundError,
  TemplateVersionNotEditableError,
} from '../domain/errors/index.js';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateRepository } from '../domain/ports/template-repository.js';
import type { TemplateVersionReader } from '../domain/ports/template-version-reader.js';
import type { TemplateVersionRepository } from '../domain/ports/template-version-repository.js';
import { EditTemplateUseCase } from './edit-template.js';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const EARLIER = new Date('2026-11-10T12:00:00.000Z');
const HTML = '<p>{{program.name}}</p>';

const template = Template.create({
  id: 't1',
  code: 'FO-01',
  name: 'Anexo 1',
  type: 'ANNEX',
  variables: [{ key: 'program.name', label: 'Programa' }],
});

const command = { actorId: 'user-1', ip: '10.0.0.1', templateId: 't1', content: HTML };

function draftVersion(content = '<p>borrador</p>'): TemplateVersion {
  return TemplateVersion.createDraft({
    id: 'd1',
    templateId: 't1',
    number: 2,
    content,
    actorId: 'user-0',
    now: EARLIER,
  });
}

describe('EditTemplateUseCase (T-018-21, RF-018, RS-020)', () => {
  let templateRepository: MockProxy<TemplateRepository>;
  let versionReader: MockProxy<TemplateVersionReader>;
  let versionRepository: MockProxy<TemplateVersionRepository>;
  let permissionChecker: MockProxy<TemplatePermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: EditTemplateUseCase;

  beforeEach(() => {
    templateRepository = mock<TemplateRepository>();
    versionReader = mock<TemplateVersionReader>();
    versionRepository = mock<TemplateVersionRepository>();
    permissionChecker = mock<TemplatePermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => await work());
    templateRepository.lockForUpdate.mockResolvedValue(template);
    versionReader.findDraft.mockResolvedValue(null);
    versionReader.maxNumber.mockResolvedValue(1);
    versionRepository.updateDraftContent.mockResolvedValue(true);
    useCase = new EditTemplateUseCase({
      templateRepository,
      versionReader,
      versionRepository,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => 'new-id',
      clock: () => NOW,
    });
  });

  it('creates the next draft when there is none and audits a CREATE without the HTML', async () => {
    const result = await useCase.execute(command);

    expect(result.created).toBe(true);
    expect(result.version).toMatchObject({
      id: 'new-id',
      number: 2,
      status: 'DRAFT',
      publishedAt: null,
      content: HTML,
    });
    expect(versionRepository.saveDraft).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    const event = auditLogger.log.mock.calls[0]![0];
    expect(event).toMatchObject({
      action: 'CREATE',
      entity: 'TemplateVersion',
      entityId: 'new-id',
      actor: 'user-1',
      ip: '10.0.0.1',
      before: null,
    });
    expect(event.after).toMatchObject({ templateId: 't1', number: 2, status: 'DRAFT' });
    expect(JSON.stringify(event)).not.toContain(HTML);
    expect((event.after as { contentSha256: string }).contentSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('numbers the first draft as version 1 when the template has no versions', async () => {
    versionReader.maxNumber.mockResolvedValue(0);

    const result = await useCase.execute(command);

    expect(result.version.number).toBe(1);
  });

  it('locks the template before reading the draft and inside the transaction', async () => {
    await useCase.execute(command);

    const order = [
      templateRepository.lockForUpdate.mock.invocationCallOrder[0]!,
      versionReader.findDraft.mock.invocationCallOrder[0]!,
    ];
    expect(order[0]).toBeLessThan(order[1]!);
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
  });

  it('updates the existing draft and audits an UPDATE with before and after', async () => {
    versionReader.findDraft.mockResolvedValue(draftVersion());

    const result = await useCase.execute(command);

    expect(result.created).toBe(false);
    expect(result.version).toMatchObject({ id: 'd1', number: 2, content: HTML });
    expect(result.version.updatedAt).toBe(NOW.toISOString());
    expect(versionRepository.updateDraftContent).toHaveBeenCalledWith('d1', HTML, 'user-1', NOW);
    expect(versionRepository.saveDraft).not.toHaveBeenCalled();
    const event = auditLogger.log.mock.calls[0]![0];
    expect(event.action).toBe('UPDATE');
    expect(event.entityId).toBe('d1');
    const before = event.before as { contentSha256: string };
    const after = event.after as { contentSha256: string };
    expect(before.contentSha256).not.toBe(after.contentSha256);
    expect(JSON.stringify(event)).not.toContain(HTML);
  });

  it('is idempotent: identical content writes and audits nothing', async () => {
    versionReader.findDraft.mockResolvedValue(draftVersion(HTML));

    const result = await useCase.execute(command);

    expect(result.created).toBe(false);
    expect(result.version.content).toBe(HTML);
    expect(versionRepository.updateDraftContent).not.toHaveBeenCalled();
    expect(versionRepository.saveDraft).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('denies without the permission and touches nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute(command)).rejects.toThrow(ForbiddenError);

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'plantilla.editar',
      scope: 'GLOBAL',
    });
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(templateRepository.lockForUpdate).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('reports a missing template as 404 without writing', async () => {
    templateRepository.lockForUpdate.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toThrow(TemplateNotFoundError);

    expect(versionRepository.saveDraft).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects a variable the template does not declare', async () => {
    await expect(
      useCase.execute({ ...command, content: '<p>{{unknown.key}}</p>' }),
    ).rejects.toThrow(InvalidTemplateDataError);

    expect(versionRepository.saveDraft).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('rejects unsafe HTML', async () => {
    await expect(
      useCase.execute({ ...command, content: '<p>x</p><script>alert(1)</script>' }),
    ).rejects.toThrow(InvalidTemplateDataError);

    expect(versionRepository.saveDraft).not.toHaveBeenCalled();
  });

  it('rejects blank content', async () => {
    await expect(useCase.execute({ ...command, content: '   ' })).rejects.toThrow(
      InvalidTemplateDataError,
    );
  });

  it('fails with 409 and no audit when the draft stopped being a draft (0 rows)', async () => {
    versionReader.findDraft.mockResolvedValue(draftVersion());
    versionRepository.updateDraftContent.mockResolvedValue(false);

    await expect(useCase.execute(command)).rejects.toThrow(TemplateVersionNotEditableError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('propagates the typed conflict when another draft appeared meanwhile', async () => {
    versionRepository.saveDraft.mockRejectedValue(new TemplateDraftExistsError());

    await expect(useCase.execute(command)).rejects.toThrow(TemplateDraftExistsError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });
});
