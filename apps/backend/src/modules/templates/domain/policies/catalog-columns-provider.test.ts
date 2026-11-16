import { describe, expect, it } from 'vitest';
import { CatalogColumnsUnavailableError } from '../errors/catalog-columns-unavailable-error.js';
import type { CatalogColumnsReader } from '../ports/catalog-columns-reader.js';
import type { CatalogColumns } from './catalog-columns.js';
import { CatalogColumnsProvider } from './catalog-columns-provider.js';

function createInMemoryReader(columns: CatalogColumns | null): CatalogColumnsReader {
  return {
    async readCurrent() {
      return columns;
    },
  };
}

function createSampleColumns(): CatalogColumns {
  return {
    catalogVersionId: 'cv-2026-1',
    catalogVersionNumber: 3,
    objectives: [
      { code: 'OEP2', statement: 'Segundo objetivo', order: 2 },
      { code: 'OEP1', statement: 'Primer objetivo', order: 1 },
    ],
    attributes: [
      { code: 'AG-C02', name: 'Diseño', statement: 'Diseña soluciones', order: 2 },
      { code: 'AG-C01', name: 'Conocimientos', statement: 'Aplica conocimientos', order: 1 },
    ],
  };
}

describe('CatalogColumnsProvider', () => {
  it('returns the columns of the current catalog', async () => {
    const expected = createSampleColumns();
    const provider = new CatalogColumnsProvider({
      reader: createInMemoryReader(expected),
    });

    const columns = await provider.getColumns();

    expect(columns).toEqual(expected);
  });

  it('orders items by their order field', async () => {
    const provider = new CatalogColumnsProvider({
      reader: createInMemoryReader(createSampleColumns()),
    });

    const renderData = await provider.getRenderData();

    expect(renderData.collections.objectives).toEqual([
      { code: 'OEP1', statement: 'Primer objetivo' },
      { code: 'OEP2', statement: 'Segundo objetivo' },
    ]);
    expect(renderData.collections.attributes).toEqual([
      { code: 'AG-C01', name: 'Conocimientos', statement: 'Aplica conocimientos' },
      { code: 'AG-C02', name: 'Diseño', statement: 'Diseña soluciones' },
    ]);
  });

  it('does not depend on a fixed number of items', async () => {
    const fiveObjectives = Array.from({ length: 5 }, (_, index) => ({
      code: `OEP${index + 1}`,
      statement: `Objetivo ${index + 1}`,
      order: index + 1,
    }));
    const thirteenAttributes = Array.from({ length: 13 }, (_, index) => ({
      code: `AG-C${String(index + 1).padStart(2, '0')}`,
      name: `Atributo ${index + 1}`,
      statement: `Descripción ${index + 1}`,
      order: index + 1,
    }));

    const provider = new CatalogColumnsProvider({
      reader: createInMemoryReader({
        catalogVersionId: 'cv-custom',
        catalogVersionNumber: 4,
        objectives: fiveObjectives,
        attributes: thirteenAttributes,
      }),
    });

    const renderData = await provider.getRenderData();

    expect(renderData.collections.objectives).toHaveLength(5);
    expect(renderData.collections.attributes).toHaveLength(13);
  });

  it('throws CatalogColumnsUnavailableError when there is no current catalog', async () => {
    const provider = new CatalogColumnsProvider({
      reader: createInMemoryReader(null),
    });

    await expect(provider.getColumns()).rejects.toBeInstanceOf(CatalogColumnsUnavailableError);
    await expect(provider.getRenderData()).rejects.toThrow(
      'No hay un catálogo vigente del cual generar las columnas de OE y AG.',
    );
  });

  it('merges catalog collections over the base ones', async () => {
    const provider = new CatalogColumnsProvider({
      reader: createInMemoryReader(createSampleColumns()),
    });

    const renderData = await provider.getRenderData({
      scalars: { programName: 'EPIS' },
      collections: {
        objectives: [{ code: 'OLD', statement: 'Obsoleto' }],
        attributes: [{ code: 'OLD-AG', name: 'Obsoleto', statement: 'Obsoleto' }],
        courses: [{ code: 'IS-101', name: 'Algoritmos' }],
      },
    });

    expect(renderData.collections.objectives).toEqual([
      { code: 'OEP1', statement: 'Primer objetivo' },
      { code: 'OEP2', statement: 'Segundo objetivo' },
    ]);
    expect(renderData.collections.attributes).toEqual([
      { code: 'AG-C01', name: 'Conocimientos', statement: 'Aplica conocimientos' },
      { code: 'AG-C02', name: 'Diseño', statement: 'Diseña soluciones' },
    ]);
    expect(renderData.collections.courses).toEqual([{ code: 'IS-101', name: 'Algoritmos' }]);
  });

  it('keeps the base scalars untouched', async () => {
    const provider = new CatalogColumnsProvider({
      reader: createInMemoryReader(createSampleColumns()),
    });

    const renderData = await provider.getRenderData({
      scalars: { programName: 'EPIS', semester: '2026-I' },
      collections: {},
    });

    expect(renderData.scalars).toEqual({
      programName: 'EPIS',
      semester: '2026-I',
    });
  });

  it('exposes the catalog version id and number', async () => {
    const provider = new CatalogColumnsProvider({
      reader: createInMemoryReader(createSampleColumns()),
    });

    const columns = await provider.getColumns();

    expect(columns.catalogVersionId).toBe('cv-2026-1');
    expect(columns.catalogVersionNumber).toBe(3);
  });
});
