import { describe, expect, it } from 'vitest';
import {
  CATALOG_VERSION_STATUSES,
  catalogVersionDtoSchema,
  catalogVersionStatusSchema,
  createCatalogVersionRequestSchema,
  listCatalogVersionsQuerySchema,
  listCatalogVersionsResponseSchema,
  sendCatalogVersionToValidationRequestSchema,
} from './catalog-version.js';

const dto = {
  id: 'v2',
  programId: 'p1',
  number: 2,
  status: 'DRAFT',
  basedOnVersionId: 'v1',
  objectiveCount: 4,
  attributeCount: 12,
  createdAt: '2026-11-12T10:00:00.000Z',
};

describe('catalog version schemas (T-013-12, RF-013)', () => {
  describe('create request', () => {
    it('accepts an empty object and an absent body', () => {
      expect(createCatalogVersionRequestSchema.safeParse({}).success).toBe(true);
      expect(createCatalogVersionRequestSchema.safeParse(undefined).success).toBe(true);
    });

    it.each([{ programId: 'p1' }, { basedOnVersionId: 'v1' }, { foo: 1 }])(
      'rejects the unknown field %j',
      (body) => {
        expect(createCatalogVersionRequestSchema.safeParse(body).success).toBe(false);
      },
    );

    it.each([null, 'texto', 5, []])('rejects the non-object body %j', (body) => {
      expect(createCatalogVersionRequestSchema.safeParse(body).success).toBe(false);
    });
  });

  describe('send to validation request (HU-015)', () => {
    it('accepts an empty object and an absent body', () => {
      expect(sendCatalogVersionToValidationRequestSchema.safeParse({}).success).toBe(true);
      expect(sendCatalogVersionToValidationRequestSchema.safeParse(undefined).success).toBe(true);
    });

    it.each([{ status: 'IN_VALIDATION' }, { versionId: 'v2' }, { foo: 1 }])(
      'rejects the unknown field %j',
      (body) => {
        expect(sendCatalogVersionToValidationRequestSchema.safeParse(body).success).toBe(false);
      },
    );

    it.each([null, 'texto', 5, []])('rejects the non-object body %j', (body) => {
      expect(sendCatalogVersionToValidationRequestSchema.safeParse(body).success).toBe(false);
    });
  });

  describe('list query', () => {
    it('accepts an empty query', () => {
      expect(listCatalogVersionsQuerySchema.safeParse({}).success).toBe(true);
    });

    it.each([{ page: '0' }, { pageSize: '100000' }, { foo: 'x' }])(
      'rejects the query %j',
      (query) => {
        expect(listCatalogVersionsQuerySchema.safeParse(query).success).toBe(false);
      },
    );
  });

  describe('status', () => {
    it.each(CATALOG_VERSION_STATUSES)('accepts %s', (status) => {
      expect(catalogVersionStatusSchema.safeParse(status).success).toBe(true);
    });

    it.each(['draft', 'ARCHIVED', '', null])('rejects %j', (status) => {
      expect(catalogVersionStatusSchema.safeParse(status).success).toBe(false);
    });
  });

  describe('dto', () => {
    it('accepts a full version', () => {
      expect(catalogVersionDtoSchema.safeParse(dto).success).toBe(true);
    });

    it('accepts a version without source and without items (incomplete but valid)', () => {
      const parsed = catalogVersionDtoSchema.safeParse({
        ...dto,
        basedOnVersionId: null,
        objectiveCount: 0,
        attributeCount: 0,
      });
      expect(parsed.success).toBe(true);
    });

    it.each([
      { number: 0 },
      { objectiveCount: -1 },
      { attributeCount: 1.5 },
      { status: 'OTHER' },
      { createdAt: '12/11/2026' },
      { basedOnVersionId: '' },
      { extra: true },
    ])('rejects the change %j', (change) => {
      expect(catalogVersionDtoSchema.safeParse({ ...dto, ...change }).success).toBe(false);
    });

    it('rejects a missing required field', () => {
      const { programId: _omitted, ...incomplete } = dto;
      expect(catalogVersionDtoSchema.safeParse(incomplete).success).toBe(false);
    });
  });

  describe('list response', () => {
    it('accepts an empty and a populated list', () => {
      expect(listCatalogVersionsResponseSchema.safeParse({ items: [] }).success).toBe(true);
      expect(listCatalogVersionsResponseSchema.safeParse({ items: [dto] }).success).toBe(true);
    });

    it('rejects extra fields and invalid items', () => {
      expect(listCatalogVersionsResponseSchema.safeParse({ items: [], total: 0 }).success).toBe(
        false,
      );
      expect(
        listCatalogVersionsResponseSchema.safeParse({ items: [{ ...dto, number: 0 }] }).success,
      ).toBe(false);
    });
  });
});
