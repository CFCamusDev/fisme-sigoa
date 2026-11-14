import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { CatalogVersion } from '../domain/entities/catalog-version.js';
import { EducationalObjective } from '../domain/entities/educational-objective.js';
import { GraduateAttribute } from '../domain/entities/graduate-attribute.js';
import { CatalogVersionNotFoundError } from '../domain/errors/index.js';
import type { CatalogPermissionChecker } from '../domain/ports/catalog-permission-checker.js';
import type { CatalogVersionHistoryReader } from '../domain/ports/catalog-version-history-reader.js';
import type { CatalogVersionReader } from '../domain/ports/catalog-version-reader.js';
import type { EducationalObjectiveReader } from '../domain/ports/educational-objective-reader.js';
import type { GraduateAttributeReader } from '../domain/ports/graduate-attribute-reader.js';
import { GetCatalogVersionDetailUseCase } from './get-catalog-version-detail.js';

const NOW = new Date('2026-11-12T12:00:00.000Z');

describe('GetCatalogVersionDetailUseCase (HU-014, D8, RF-014)', () => {
  let versionReader: MockProxy<CatalogVersionReader>;
  let objectiveReader: MockProxy<EducationalObjectiveReader>;
  let attributeReader: MockProxy<GraduateAttributeReader>;
  let permissionChecker: MockProxy<CatalogPermissionChecker>;
  let historyReader: MockProxy<CatalogVersionHistoryReader>;
  let useCase: GetCatalogVersionDetailUseCase;

  beforeEach(() => {
    versionReader = mock<CatalogVersionReader>();
    objectiveReader = mock<EducationalObjectiveReader>();
    attributeReader = mock<GraduateAttributeReader>();
    permissionChecker = mock<CatalogPermissionChecker>();
    versionReader.findById.mockResolvedValue(
      CatalogVersion.create({
        id: 'v2',
        programId: 'p1',
        number: 2,
        status: 'DRAFT',
        basedOnVersionId: 'v1',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    objectiveReader.listByVersion.mockResolvedValue([
      EducationalObjective.create({
        id: 'o1',
        versionId: 'v2',
        code: 'OEP1',
        statement: 'Texto.',
        order: 1,
        createdBy: 'user-9',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ]);
    attributeReader.listByVersion.mockResolvedValue([
      GraduateAttribute.create({
        id: 'a1',
        versionId: 'v2',
        code: 'AG-C01',
        name: 'Nombre',
        statement: 'Texto.',
        order: 1,
        updatedBy: 'user-9',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ]);
    versionReader.list.mockResolvedValue([]);
    historyReader = mock<CatalogVersionHistoryReader>();
    historyReader.listForProgram.mockResolvedValue(new Map());
    useCase = new GetCatalogVersionDetailUseCase({
      versionReader,
      objectiveReader,
      attributeReader,
      historyReader,
      permissionChecker,
    });
  });

  it('returns the version with counts, objectives and attributes without personal data', async () => {
    const detail = await useCase.execute({ actorId: 'user-1', versionId: 'v2' });

    expect(detail.version).toMatchObject({
      id: 'v2',
      status: 'DRAFT',
      objectiveCount: 1,
      attributeCount: 1,
    });
    expect(detail.objectives[0]).toEqual({
      id: 'o1',
      code: 'OEP1',
      statement: 'Texto.',
      order: 1,
      updatedAt: NOW.toISOString(),
    });
    expect(JSON.stringify(detail)).not.toContain('user-9');
  });

  it('includes the resolution and validity dates of a historical version', async () => {
    const historical = CatalogVersion.create({
      id: 'v1',
      programId: 'p1',
      number: 1,
      status: 'HISTORICAL',
      basedOnVersionId: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    const current = CatalogVersion.create({
      id: 'v2',
      programId: 'p1',
      number: 2,
      status: 'APPROVED',
      basedOnVersionId: 'v1',
      createdAt: NOW,
      updatedAt: NOW,
    });
    versionReader.findById.mockResolvedValue(historical);
    versionReader.list.mockResolvedValue([current, historical]);
    historyReader.listForProgram.mockResolvedValue(
      new Map([
        [
          'v1',
          [
            {
              id: 'r1',
              type: 'EDUCATIONAL_OBJECTIVE' as const,
              number: '128-2024',
              issuedOn: new Date('2024-02-20T00:00:00.000Z'),
              status: 'APPROVED' as const,
              approvedAt: new Date('2024-03-01T10:00:00.000Z'),
              hasPdf: false,
            },
          ],
        ],
        [
          'v2',
          [
            {
              id: 'r2',
              type: 'GRADUATE_ATTRIBUTE' as const,
              number: '210-2026',
              issuedOn: new Date('2026-05-02T00:00:00.000Z'),
              status: 'APPROVED' as const,
              approvedAt: new Date('2026-05-10T09:00:00.000Z'),
              hasPdf: true,
            },
          ],
        ],
      ]),
    );

    const detail = await useCase.execute({ actorId: 'user-1', versionId: 'v1' });

    expect(detail.history.validFrom).toBe('2024-03-01T10:00:00.000Z');
    expect(detail.history.validUntil).toBe('2026-05-10T09:00:00.000Z');
    expect(detail.history.resolutions).toEqual([
      {
        id: 'r1',
        type: 'EDUCATIONAL_OBJECTIVE',
        number: '128-2024',
        issuedOn: '2024-02-20',
        status: 'APPROVED',
        approvedAt: '2024-03-01T10:00:00.000Z',
        hasPdf: false,
      },
    ]);
  });

  it('answers not found for a version that does not exist', async () => {
    versionReader.findById.mockResolvedValue(null);

    await expect(useCase.execute({ actorId: 'user-1', versionId: 'zzz' })).rejects.toBeInstanceOf(
      CatalogVersionNotFoundError,
    );
  });

  it('denies access without catalogo.ver before reading anything', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(useCase.execute({ actorId: 'user-1', versionId: 'v2' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(versionReader.findById).not.toHaveBeenCalled();
  });
});
