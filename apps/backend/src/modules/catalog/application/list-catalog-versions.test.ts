import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { CatalogVersion, type CatalogVersionStatus } from '../domain/entities/catalog-version.js';
import { CatalogProgramNotFoundError } from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogProgramReader } from '../domain/ports/catalog-program-reader.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { ListCatalogVersionsUseCase } from './list-catalog-versions.js';

const NOW = new Date('2026-11-12T12:00:00.000Z');

function version(id: string, number: number, status: CatalogVersionStatus, basedOn: string | null) {
  return CatalogVersion.create({
    id,
    programId: 'p1',
    number,
    status,
    basedOnVersionId: basedOn,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('ListCatalogVersionsUseCase (T-013-10, T-013-18, RF-013)', () => {
  let programReader: MockProxy<CatalogProgramReader>;
  let versionReader: MockProxy<CatalogVersionReader>;
  let objectiveReader: MockProxy<EducationalObjectiveReader>;
  let attributeReader: MockProxy<GraduateAttributeReader>;
  let permissionChecker: MockProxy<CatalogPermissionChecker>;
  let useCase: ListCatalogVersionsUseCase;

  beforeEach(() => {
    programReader = mock<CatalogProgramReader>();
    versionReader = mock<CatalogVersionReader>();
    objectiveReader = mock<EducationalObjectiveReader>();
    attributeReader = mock<GraduateAttributeReader>();
    permissionChecker = mock<CatalogPermissionChecker>();
    programReader.getCurrentProgramId.mockResolvedValue('p1');
    versionReader.list.mockResolvedValue([
      version('v2', 2, 'DRAFT', 'v1'),
      version('v1', 1, 'APPROVED', null),
    ]);
    objectiveReader.countByVersionIds.mockResolvedValue(new Map([['v1', 4]]));
    attributeReader.countByVersionIds.mockResolvedValue(new Map([['v1', 12]]));
    useCase = new ListCatalogVersionsUseCase({
      programReader,
      versionReader,
      objectiveReader,
      attributeReader,
      permissionChecker,
    });
  });

  it('checks catalogo.ver with GLOBAL scope before reading', async () => {
    await useCase.execute({ actorId: 'user-1' });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'catalogo.ver',
      scope: 'GLOBAL',
    });
    expect(permissionChecker.assertAllowed.mock.invocationCallOrder[0]).toBeLessThan(
      programReader.getCurrentProgramId.mock.invocationCallOrder[0]!,
    );
  });

  it('reads nothing when the permission is denied', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(useCase.execute({ actorId: 'user-1' })).rejects.toBeInstanceOf(ForbiddenError);

    expect(versionReader.list).not.toHaveBeenCalled();
  });

  it('fails with a typed not found error when there is no program', async () => {
    programReader.getCurrentProgramId.mockResolvedValue(null);

    await expect(useCase.execute({ actorId: 'user-1' })).rejects.toBeInstanceOf(
      CatalogProgramNotFoundError,
    );
  });

  it('returns the versions in the order given with their counts, zero when missing', async () => {
    const response = await useCase.execute({ actorId: 'user-1' });

    expect(response.items.map((item) => [item.number, item.status])).toEqual([
      [2, 'DRAFT'],
      [1, 'APPROVED'],
    ]);
    expect(response.items[0]).toMatchObject({
      basedOnVersionId: 'v1',
      objectiveCount: 0,
      attributeCount: 0,
    });
    expect(response.items[1]).toMatchObject({
      basedOnVersionId: null,
      objectiveCount: 4,
      attributeCount: 12,
    });
  });

  it('asks for the counts of all versions with one query per kind', async () => {
    await useCase.execute({ actorId: 'user-1' });

    expect(objectiveReader.countByVersionIds).toHaveBeenCalledTimes(1);
    expect(objectiveReader.countByVersionIds).toHaveBeenCalledWith(['v2', 'v1']);
    expect(attributeReader.countByVersionIds).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list when the program has no versions', async () => {
    versionReader.list.mockResolvedValue([]);
    objectiveReader.countByVersionIds.mockResolvedValue(new Map());
    attributeReader.countByVersionIds.mockResolvedValue(new Map());

    expect(await useCase.execute({ actorId: 'user-1' })).toEqual({ items: [] });
  });
});
