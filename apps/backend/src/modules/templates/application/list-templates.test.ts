import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { Template } from '../domain/entities/template.js';
import { TemplateVersion } from '../domain/entities/template-version.js';
import { TemplateNotFoundError } from '../domain/errors/index.js';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateReader } from '../domain/ports/template-reader.js';
import type { TemplateVersionReader } from '../domain/ports/template-version-reader.js';
import { GetTemplateDetailUseCase } from './get-template-detail.js';
import { ListTemplatesUseCase } from './list-templates.js';

const AT = new Date('2026-11-14T12:00:00.000Z');

function template(id: string, code: string, type: 'ANNEX' | 'SURVEY' = 'ANNEX'): Template {
  return Template.create({ id, code, name: `Plantilla ${code}`, type, variables: [] });
}

function version(
  id: string,
  templateId: string,
  number: number,
  status: 'DRAFT' | 'PUBLISHED' | 'OBSOLETE',
): TemplateVersion {
  const draft = TemplateVersion.createDraft({
    id,
    templateId,
    number,
    content: `<p>versión ${number}</p>`,
    now: AT,
  });
  if (status === 'DRAFT') return draft;
  const published = draft.publish({ actorId: 'seed', now: AT });
  return status === 'PUBLISHED' ? published : published.markObsolete({ actorId: 'seed', now: AT });
}

describe('ListTemplatesUseCase (T-018-23, RF-018)', () => {
  let templateReader: MockProxy<TemplateReader>;
  let versionReader: MockProxy<TemplateVersionReader>;
  let permissionChecker: MockProxy<TemplatePermissionChecker>;
  let useCase: ListTemplatesUseCase;

  beforeEach(() => {
    templateReader = mock<TemplateReader>();
    versionReader = mock<TemplateVersionReader>();
    permissionChecker = mock<TemplatePermissionChecker>();
    useCase = new ListTemplatesUseCase({ templateReader, versionReader, permissionChecker });
  });

  it('lists templates with their published version and draft using one versions query', async () => {
    const t1 = template('t1', 'FO-01');
    const t2 = template('t2', 'FO-02');
    const t3 = template('t3', 'FO-03');
    templateReader.list.mockResolvedValue({ items: [t1, t2, t3], total: 3 });
    versionReader.findCurrentByTemplateIds.mockResolvedValue(
      new Map([
        [
          't1',
          {
            published: version('v1', 't1', 1, 'PUBLISHED'),
            draft: version('v2', 't1', 2, 'DRAFT'),
          },
        ],
        ['t2', { published: version('v3', 't2', 1, 'PUBLISHED'), draft: null }],
      ]),
    );

    const result = await useCase.execute({ actorId: 'user-1', page: 1, pageSize: 50 });

    expect(versionReader.findCurrentByTemplateIds).toHaveBeenCalledTimes(1);
    expect(versionReader.findCurrentByTemplateIds).toHaveBeenCalledWith(['t1', 't2', 't3']);
    expect(result.items.map((item) => item.code)).toEqual(['FO-01', 'FO-02', 'FO-03']);
    expect(result.items[0]?.published).toMatchObject({ id: 'v1', number: 1, status: 'PUBLISHED' });
    expect(result.items[0]?.draft).toMatchObject({ id: 'v2', number: 2, status: 'DRAFT' });
    expect(result.items[1]?.draft).toBeNull();
    // Plantilla sin versiones: incompleto pero válido.
    expect(result.items[2]).toMatchObject({ published: null, draft: null });
    expect(result).toMatchObject({ page: 1, pageSize: 50, total: 3, totalPages: 1 });
  });

  it('passes the type filter and the pagination to the reader', async () => {
    templateReader.list.mockResolvedValue({ items: [], total: 0 });
    versionReader.findCurrentByTemplateIds.mockResolvedValue(new Map());

    await useCase.execute({ actorId: 'user-1', type: 'SURVEY', page: 2, pageSize: 10 });

    expect(templateReader.list).toHaveBeenCalledWith({ type: 'SURVEY', page: 2, pageSize: 10 });
  });

  it('omits the type filter when none is given', async () => {
    templateReader.list.mockResolvedValue({ items: [], total: 0 });
    versionReader.findCurrentByTemplateIds.mockResolvedValue(new Map());

    await useCase.execute({ actorId: 'user-1', page: 1, pageSize: 50 });

    expect(templateReader.list).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
  });

  it.each([
    [0, 50, 0],
    [1, 50, 1],
    [50, 50, 1],
    [51, 50, 2],
    [101, 20, 6],
  ])('computes totalPages for %i templates with pageSize %i', async (total, pageSize, pages) => {
    templateReader.list.mockResolvedValue({ items: [], total });
    versionReader.findCurrentByTemplateIds.mockResolvedValue(new Map());

    const result = await useCase.execute({ actorId: 'user-1', page: 1, pageSize });

    expect(result.totalPages).toBe(pages);
  });

  it('denies without the permission and reads nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute({ actorId: 'user-1', page: 1, pageSize: 50 })).rejects.toThrow(
      ForbiddenError,
    );

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'plantilla.ver',
      scope: 'GLOBAL',
    });
    expect(templateReader.list).not.toHaveBeenCalled();
    expect(versionReader.findCurrentByTemplateIds).not.toHaveBeenCalled();
  });
});

describe('GetTemplateDetailUseCase (T-018-23, RF-018)', () => {
  let templateReader: MockProxy<TemplateReader>;
  let versionReader: MockProxy<TemplateVersionReader>;
  let permissionChecker: MockProxy<TemplatePermissionChecker>;
  let useCase: GetTemplateDetailUseCase;

  beforeEach(() => {
    templateReader = mock<TemplateReader>();
    versionReader = mock<TemplateVersionReader>();
    permissionChecker = mock<TemplatePermissionChecker>();
    useCase = new GetTemplateDetailUseCase({ templateReader, versionReader, permissionChecker });
  });

  it('returns the history in descending order with the content of the published version and the draft', async () => {
    templateReader.findById.mockResolvedValue(template('t1', 'FO-01'));
    versionReader.listByTemplate.mockResolvedValue([
      version('v1', 't1', 1, 'OBSOLETE'),
      version('v2', 't1', 2, 'PUBLISHED'),
      version('v3', 't1', 3, 'DRAFT'),
    ]);

    const result = await useCase.execute({ actorId: 'user-1', templateId: 't1' });

    expect(result.versions.map((item) => item.number)).toEqual([3, 2, 1]);
    expect(result.published?.content).toBe('<p>versión 2</p>');
    expect(result.draft?.content).toBe('<p>versión 3</p>');
  });

  it('returns a template without versions with null published and draft', async () => {
    templateReader.findById.mockResolvedValue(template('t1', 'FO-01'));
    versionReader.listByTemplate.mockResolvedValue([]);

    const result = await useCase.execute({ actorId: 'user-1', templateId: 't1' });

    expect(result).toMatchObject({ versions: [], published: null, draft: null });
  });

  it('reports a missing template as 404', async () => {
    templateReader.findById.mockResolvedValue(null);

    await expect(useCase.execute({ actorId: 'user-1', templateId: 'nope' })).rejects.toThrow(
      TemplateNotFoundError,
    );

    expect(versionReader.listByTemplate).not.toHaveBeenCalled();
  });

  it('denies without the permission and reads nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(useCase.execute({ actorId: 'user-1', templateId: 't1' })).rejects.toThrow(
      ForbiddenError,
    );

    expect(templateReader.findById).not.toHaveBeenCalled();
    expect(versionReader.listByTemplate).not.toHaveBeenCalled();
  });
});
