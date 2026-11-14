import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { CatalogVersion, type CatalogVersionStatus } from '../domain/entities/catalog-version.js';
import { EducationalObjective } from '../domain/entities/educational-objective.js';
import { GraduateAttribute } from '../domain/entities/graduate-attribute.js';
import { CatalogVersionNotFoundError, InvalidCatalogDataError } from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type {
  CatalogVersionHistoryReader,
  CatalogVersionResolutionRecord,
} from '../domain/ports/catalog-version-history-reader.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { CompareCatalogVersionsUseCase } from './compare-catalog-versions.js';

const NOW = new Date('2026-11-12T12:00:00.000Z');

function version(id: string, number: number, status: CatalogVersionStatus, programId = 'p1') {
  return CatalogVersion.create({
    id,
    programId,
    number,
    status,
    basedOnVersionId: null,
    createdBy: 'user-secret',
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function objective(versionId: string, code: string, statement: string, order: number) {
  return EducationalObjective.create({
    id: `${versionId}-${code}`,
    versionId,
    code,
    statement,
    order,
    createdBy: 'user-secret',
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function attribute(versionId: string, code: string, name: string, statement: string) {
  return GraduateAttribute.create({
    id: `${versionId}-${code}`,
    versionId,
    code,
    name,
    statement,
    order: 1,
    updatedBy: 'user-secret',
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function resolution(
  overrides: Partial<CatalogVersionResolutionRecord> = {},
): CatalogVersionResolutionRecord {
  return {
    id: 'r1',
    type: 'EDUCATIONAL_OBJECTIVE',
    number: '128-2024',
    issuedOn: new Date('2024-02-20T00:00:00.000Z'),
    status: 'APPROVED',
    approvedAt: new Date('2024-03-01T10:00:00.000Z'),
    hasPdf: true,
    ...overrides,
  };
}

describe('CompareCatalogVersionsUseCase (HU-017, RF-017)', () => {
  let versionReader: MockProxy<CatalogVersionReader>;
  let objectiveReader: MockProxy<EducationalObjectiveReader>;
  let attributeReader: MockProxy<GraduateAttributeReader>;
  let historyReader: MockProxy<CatalogVersionHistoryReader>;
  let permissionChecker: MockProxy<CatalogPermissionChecker>;
  let useCase: CompareCatalogVersionsUseCase;

  beforeEach(() => {
    versionReader = mock<CatalogVersionReader>();
    objectiveReader = mock<EducationalObjectiveReader>();
    attributeReader = mock<GraduateAttributeReader>();
    historyReader = mock<CatalogVersionHistoryReader>();
    permissionChecker = mock<CatalogPermissionChecker>();

    const v1 = version('v1', 1, 'HISTORICAL');
    const v2 = version('v2', 2, 'APPROVED');
    versionReader.findById.mockImplementation(async (id) =>
      id === 'v1'
        ? v1
        : id === 'v2'
          ? v2
          : id === 'other'
            ? version('other', 1, 'APPROVED', 'p2')
            : null,
    );
    versionReader.list.mockResolvedValue([v2, v1]);
    objectiveReader.listByVersion.mockImplementation(async (id) =>
      id === 'v1'
        ? [objective('v1', 'OEP1', 'Formar ingenieros éticos.', 1)]
        : [
            objective('v2', 'OEP1', 'Formar ingenieros líderes.', 1),
            objective('v2', 'OEP2', 'Promover la investigación.', 2),
          ],
    );
    attributeReader.listByVersion.mockImplementation(async (id) => [
      attribute(id, 'AG-C01', 'Conocimiento', 'Aplica matemáticas.'),
    ]);
    historyReader.listForProgram.mockResolvedValue(
      new Map([
        ['v1', [resolution()]],
        [
          'v2',
          [
            resolution({
              id: 'r2',
              number: '210-2026',
              approvedAt: new Date('2026-05-10T09:00:00.000Z'),
              issuedOn: new Date('2026-05-02T00:00:00.000Z'),
            }),
          ],
        ],
      ]),
    );
    useCase = new CompareCatalogVersionsUseCase({
      versionReader,
      objectiveReader,
      attributeReader,
      historyReader,
      permissionChecker,
    });
  });

  it('compares two versions of the same program', async () => {
    const result = await useCase.execute({ actorId: 'user-1', baseId: 'v1', targetId: 'v2' });

    expect(result.summary).toEqual({ added: 1, removed: 0, modified: 1, unchanged: 1 });
    expect(result.objectives.map((item) => [item.code, item.change])).toEqual([
      ['OEP1', 'MODIFIED'],
      ['OEP2', 'ADDED'],
    ]);
    expect(result.objectives[0]?.statementSegments).toContainEqual({
      type: 'REMOVED',
      text: 'éticos.',
    });
    expect(result.attributes[0]?.change).toBe('UNCHANGED');
    expect(result.base.version).toMatchObject({ id: 'v1', objectiveCount: 1, attributeCount: 1 });
    expect(result.target.version).toMatchObject({ id: 'v2', objectiveCount: 2 });
  });

  it('includes the resolution and validity of both versions without personal data', async () => {
    const result = await useCase.execute({ actorId: 'user-1', baseId: 'v1', targetId: 'v2' });

    expect(result.base.history).toEqual({
      validFrom: '2024-03-01T10:00:00.000Z',
      validUntil: '2026-05-10T09:00:00.000Z',
      resolutions: [
        {
          id: 'r1',
          type: 'EDUCATIONAL_OBJECTIVE',
          number: '128-2024',
          issuedOn: '2024-02-20',
          status: 'APPROVED',
          approvedAt: '2024-03-01T10:00:00.000Z',
          hasPdf: true,
        },
      ],
    });
    expect(result.target.history.validUntil).toBeNull();
    expect(JSON.stringify(result)).not.toContain('user-secret');
  });

  it('denies access without catalogo.ver before reading anything', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({ actorId: 'user-1', baseId: 'v1', targetId: 'v2' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(versionReader.findById).not.toHaveBeenCalled();
    expect(objectiveReader.listByVersion).not.toHaveBeenCalled();
  });

  it('answers not found when either version does not exist', async () => {
    await expect(
      useCase.execute({ actorId: 'user-1', baseId: 'zzz', targetId: 'v2' }),
    ).rejects.toBeInstanceOf(CatalogVersionNotFoundError);
    await expect(
      useCase.execute({ actorId: 'user-1', baseId: 'v1', targetId: 'zzz' }),
    ).rejects.toBeInstanceOf(CatalogVersionNotFoundError);
  });

  it('rejects comparing a version with itself', async () => {
    await expect(
      useCase.execute({ actorId: 'user-1', baseId: 'v1', targetId: 'v1' }),
    ).rejects.toBeInstanceOf(InvalidCatalogDataError);
    expect(versionReader.findById).not.toHaveBeenCalled();
  });

  it('rejects versions of different programs', async () => {
    await expect(
      useCase.execute({ actorId: 'user-1', baseId: 'v1', targetId: 'other' }),
    ).rejects.toBeInstanceOf(InvalidCatalogDataError);
    expect(objectiveReader.listByVersion).not.toHaveBeenCalled();
  });

  it('handles versions without items or resolutions', async () => {
    objectiveReader.listByVersion.mockResolvedValue([]);
    attributeReader.listByVersion.mockResolvedValue([]);
    historyReader.listForProgram.mockResolvedValue(new Map());

    const result = await useCase.execute({ actorId: 'user-1', baseId: 'v1', targetId: 'v2' });

    expect(result.summary).toEqual({ added: 0, removed: 0, modified: 0, unchanged: 0 });
    expect(result.base.history).toEqual({ validFrom: null, validUntil: null, resolutions: [] });
  });
});
