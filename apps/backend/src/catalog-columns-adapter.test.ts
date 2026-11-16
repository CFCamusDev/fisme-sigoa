import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { createCatalogColumnsReader } from './catalog-columns-adapter.js';
import {
  CatalogVersion,
  EducationalObjective,
  GraduateAttribute,
  type CatalogProgramReader,
  type CatalogVersionReader,
  type EducationalObjectiveReader,
  type GraduateAttributeReader,
} from './modules/catalog/index.js';

function createMocks() {
  const programReader = mock<CatalogProgramReader>();
  const versionReader = mock<CatalogVersionReader>();
  const objectiveReader = mock<EducationalObjectiveReader>();
  const attributeReader = mock<GraduateAttributeReader>();
  const reader = createCatalogColumnsReader({
    programReader,
    versionReader,
    objectiveReader,
    attributeReader,
  });

  return { programReader, versionReader, objectiveReader, attributeReader, reader };
}

describe('createCatalogColumnsReader', () => {
  it('returns null when there is no current program', async () => {
    const { programReader, versionReader, reader } = createMocks();
    programReader.getCurrentProgramId.mockResolvedValue(null);

    const result = await reader.readCurrent();

    expect(result).toBeNull();
    expect(versionReader.findCurrent).not.toHaveBeenCalled();
  });

  it('returns null when the program has no current version', async () => {
    const { programReader, versionReader, objectiveReader, reader } = createMocks();
    programReader.getCurrentProgramId.mockResolvedValue('prog-1');
    versionReader.findCurrent.mockResolvedValue(null);

    const result = await reader.readCurrent();

    expect(result).toBeNull();
    expect(objectiveReader.listByVersion).not.toHaveBeenCalled();
  });

  it('maps items of the current version ordered by order', async () => {
    const { programReader, versionReader, objectiveReader, attributeReader, reader } =
      createMocks();

    const approvedVersion = CatalogVersion.reconstitute({
      id: 'cv-2',
      programId: 'prog-1',
      number: 2,
      status: 'APPROVED',
      basedOnVersionId: 'cv-1',
      resolutionId: 'res-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      createdBy: 'user-1',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedBy: 'user-1',
    });

    programReader.getCurrentProgramId.mockResolvedValue('prog-1');
    versionReader.findCurrent.mockResolvedValue(approvedVersion);
    objectiveReader.listByVersion.mockResolvedValue([
      EducationalObjective.reconstitute({
        id: 'oe-2',
        catalogVersionId: 'cv-2',
        code: 'OEP2',
        statement: 'Segundo',
        order: 2,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        createdBy: 'user-1',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedBy: 'user-1',
      }),
      EducationalObjective.reconstitute({
        id: 'oe-1',
        catalogVersionId: 'cv-2',
        code: 'OEP1',
        statement: 'Primero',
        order: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        createdBy: 'user-1',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedBy: 'user-1',
      }),
    ]);
    attributeReader.listByVersion.mockResolvedValue([
      GraduateAttribute.reconstitute({
        id: 'ag-2',
        catalogVersionId: 'cv-2',
        code: 'AG-C02',
        name: 'Ética',
        statement: 'Principios éticos',
        order: 2,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        createdBy: 'user-1',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedBy: 'user-1',
      }),
      GraduateAttribute.reconstitute({
        id: 'ag-1',
        catalogVersionId: 'cv-2',
        code: 'AG-C01',
        name: 'Profesionalismo',
        statement: 'Impacto social',
        order: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        createdBy: 'user-1',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedBy: 'user-1',
      }),
    ]);

    const result = await reader.readCurrent();

    expect(result).toEqual({
      catalogVersionId: 'cv-2',
      catalogVersionNumber: 2,
      objectives: [
        { code: 'OEP1', statement: 'Primero', order: 1 },
        { code: 'OEP2', statement: 'Segundo', order: 2 },
      ],
      attributes: [
        { code: 'AG-C01', name: 'Profesionalismo', statement: 'Impacto social', order: 1 },
        { code: 'AG-C02', name: 'Ética', statement: 'Principios éticos', order: 2 },
      ],
    });
  });
});
