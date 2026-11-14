import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { Resolution } from '../domain/entities/resolution.js';
import type { ResolutionPermissionChecker } from '../domain/ports/resolution-permission-checker.js';
import type { ResolutionReader } from '../domain/ports/resolution-reader.js';
import { ListResolutionsUseCase } from './list-resolutions.js';

const NOW = new Date('2026-11-13T12:00:00.000Z');

function registered(id: string) {
  return Resolution.register({
    id,
    type: 'EDUCATIONAL_OBJECTIVE',
    number: `RD-${id}`,
    issuedOn: new Date('2026-11-10T00:00:00.000Z'),
    catalogVersionId: 'v1',
    actorId: 'user-1',
    now: NOW,
  });
}

describe('ListResolutionsUseCase (T-048-11, RF-048)', () => {
  let resolutionReader: MockProxy<ResolutionReader>;
  let permissionChecker: MockProxy<ResolutionPermissionChecker>;
  let useCase: ListResolutionsUseCase;

  beforeEach(() => {
    resolutionReader = mock<ResolutionReader>();
    permissionChecker = mock<ResolutionPermissionChecker>();
    useCase = new ListResolutionsUseCase({ resolutionReader, permissionChecker });
  });

  it('lists a page with its totals and passes the filters to the reader', async () => {
    resolutionReader.list.mockResolvedValue({
      items: [registered('r1'), registered('r2')],
      total: 5,
    });

    const result = await useCase.execute({
      actorId: 'user-1',
      type: 'EDUCATIONAL_OBJECTIVE',
      status: 'REGISTERED',
      catalogVersionId: 'v1',
      page: 2,
      pageSize: 2,
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'resolucion.ver',
      scope: 'GLOBAL',
    });
    expect(resolutionReader.list).toHaveBeenCalledWith({
      type: 'EDUCATIONAL_OBJECTIVE',
      status: 'REGISTERED',
      catalogVersionId: 'v1',
      page: 2,
      pageSize: 2,
    });
    expect(result).toMatchObject({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
    expect(result.items.map((item) => item.id)).toEqual(['r1', 'r2']);
    expect(result.items[0]).toMatchObject({
      status: 'REGISTERED',
      pdfFileId: null,
      approvedAt: null,
      approvedBy: null,
    });
  });

  it('omits the filters that were not given', async () => {
    resolutionReader.list.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute({ actorId: 'user-1', page: 1, pageSize: 20 });

    expect(resolutionReader.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('answers an empty page with zero total pages', async () => {
    resolutionReader.list.mockResolvedValue({ items: [], total: 0 });

    const result = await useCase.execute({ actorId: 'user-1', page: 1, pageSize: 20 });

    expect(result).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });

  it('rounds the total pages up', async () => {
    resolutionReader.list.mockResolvedValue({ items: [registered('r1')], total: 21 });

    const result = await useCase.execute({ actorId: 'user-1', page: 1, pageSize: 20 });

    expect(result.totalPages).toBe(2);
  });

  it('denies the action without the permission and reads nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({ actorId: 'user-1', page: 1, pageSize: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(resolutionReader.list).not.toHaveBeenCalled();
  });
});
