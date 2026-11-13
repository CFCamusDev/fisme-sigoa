import { describe, expect, it } from 'vitest';
import {
  CATALOG_MAX_ITEMS,
  catalogAttributesRequestSchema,
  catalogAttributesResponseSchema,
  catalogObjectivesRequestSchema,
  catalogVersionDetailDtoSchema,
  catalogVersionIdParamsSchema,
  reorderCatalogItemsRequestSchema,
} from './catalog-items.js';

const objectiveSave = { operation: 'SAVE', code: 'OEP5', statement: 'Texto.' };
const attributeSave = { operation: 'SAVE', code: 'AG-C13', name: 'Nombre', statement: 'Texto.' };

describe('catalog item edit schemas (T-014-05, RF-014, RNF-008)', () => {
  describe('objectives request', () => {
    it('accepts a create without id and trims the text', () => {
      const parsed = catalogObjectivesRequestSchema.parse({
        ...objectiveSave,
        code: ' OEP5 ',
        statement: ' Texto. ',
      });
      expect(parsed).toMatchObject({ code: 'OEP5', statement: 'Texto.' });
    });

    it('accepts an edit with id and a one-character statement', () => {
      expect(
        catalogObjectivesRequestSchema.safeParse({ ...objectiveSave, id: 'oe-1', statement: 'x' })
          .success,
      ).toBe(true);
    });

    it.each([
      ['unknown operation', { ...objectiveSave, operation: 'DELETE' }],
      ['missing operation', { code: 'OEP5', statement: 'Texto.' }],
      ['extra field', { ...objectiveSave, extra: 1 }],
      ['name in an objective', { ...objectiveSave, name: 'No aplica' }],
      ['lowercase code', { ...objectiveSave, code: 'oep5' }],
      ['empty statement', { ...objectiveSave, statement: '   ' }],
      ['statement of 2001 characters', { ...objectiveSave, statement: 'x'.repeat(2001) }],
      ['id of 65 characters', { ...objectiveSave, id: 'x'.repeat(65) }],
    ])('rejects %s', (_label, body) => {
      expect(catalogObjectivesRequestSchema.safeParse(body).success).toBe(false);
    });
  });

  describe('attributes request', () => {
    it('accepts a create with name', () => {
      expect(catalogAttributesRequestSchema.safeParse(attributeSave).success).toBe(true);
    });

    it.each([
      ['missing name', { operation: 'SAVE', code: 'AG-C13', statement: 'Texto.' }],
      ['name of 121 characters', { ...attributeSave, name: 'x'.repeat(121) }],
      ['unknown field', { ...attributeSave, order: 3 }],
    ])('rejects %s', (_label, body) => {
      expect(catalogAttributesRequestSchema.safeParse(body).success).toBe(false);
    });
  });

  describe('reorder request', () => {
    it('accepts a list of ids', () => {
      expect(
        reorderCatalogItemsRequestSchema.safeParse({ operation: 'REORDER', orderedIds: ['a', 'b'] })
          .success,
      ).toBe(true);
    });

    it('accepts exactly the maximum number of ids', () => {
      const orderedIds = Array.from({ length: CATALOG_MAX_ITEMS }, (_, index) => `id-${index}`);
      expect(
        reorderCatalogItemsRequestSchema.safeParse({ operation: 'REORDER', orderedIds }).success,
      ).toBe(true);
    });

    it.each([
      ['empty list', { operation: 'REORDER', orderedIds: [] }],
      ['repeated ids', { operation: 'REORDER', orderedIds: ['a', 'a'] }],
      [
        'more than the maximum',
        {
          operation: 'REORDER',
          orderedIds: Array.from({ length: CATALOG_MAX_ITEMS + 1 }, (_, index) => `id-${index}`),
        },
      ],
      ['extra field', { operation: 'REORDER', orderedIds: ['a'], code: 'X' }],
      ['non-string ids', { operation: 'REORDER', orderedIds: [1, 2] }],
    ])('rejects %s', (_label, body) => {
      expect(reorderCatalogItemsRequestSchema.safeParse(body).success).toBe(false);
    });
  });

  describe('params and responses', () => {
    it('rejects an empty or too long version id', () => {
      expect(catalogVersionIdParamsSchema.safeParse({ id: '' }).success).toBe(false);
      expect(catalogVersionIdParamsSchema.safeParse({ id: 'x'.repeat(65) }).success).toBe(false);
      expect(catalogVersionIdParamsSchema.safeParse({ id: 'v1' }).success).toBe(true);
    });

    it('parses a list response and rejects unknown fields', () => {
      const item = {
        id: 'ag-1',
        code: 'AG-C01',
        name: 'Nombre',
        statement: 'Texto.',
        order: 1,
        updatedAt: '2026-11-12T10:00:00.000Z',
      };
      expect(catalogAttributesResponseSchema.safeParse({ items: [item] }).success).toBe(true);
      expect(
        catalogAttributesResponseSchema.safeParse({ items: [{ ...item, createdBy: 'u1' }] })
          .success,
      ).toBe(false);
    });

    it('parses a version detail', () => {
      const detail = {
        version: {
          id: 'v2',
          programId: 'p1',
          number: 2,
          status: 'DRAFT',
          basedOnVersionId: 'v1',
          objectiveCount: 0,
          attributeCount: 0,
          createdAt: '2026-11-12T10:00:00.000Z',
        },
        objectives: [],
        attributes: [],
      };
      expect(catalogVersionDetailDtoSchema.safeParse(detail).success).toBe(true);
    });
  });
});
