import { describe, expect, it } from 'vitest';
import {
  RESOLUTION_PDF_MAX_BYTES,
  RESOLUTION_PDF_MIME_TYPE,
  listResolutionsQuerySchema,
  listResolutionsResponseSchema,
  registerResolutionRequestSchema,
  resolutionDtoSchema,
  resolutionIdParamsSchema,
} from './resolutions.js';

const request = {
  type: 'EDUCATIONAL_OBJECTIVE',
  number: 'RD-012/2027-FISME',
  issuedOn: '2026-11-10',
  catalogVersionId: 'v1',
};

const dto = {
  id: 'r1',
  type: 'EDUCATIONAL_OBJECTIVE',
  number: 'RD-012/2027-FISME',
  issuedOn: '2026-11-10',
  status: 'REGISTERED',
  catalogVersionId: 'v1',
  pdfFileId: null,
  approvedAt: null,
  approvedBy: null,
  createdAt: '2026-11-13T10:00:00.000Z',
  updatedAt: '2026-11-13T10:00:00.000Z',
};

describe('resolution schemas (T-048-08, RF-048)', () => {
  describe('register request', () => {
    it('accepts a complete request', () => {
      expect(registerResolutionRequestSchema.safeParse(request).success).toBe(true);
    });

    it('trims the number', () => {
      const parsed = registerResolutionRequestSchema.parse({ ...request, number: '  RD-1  ' });
      expect(parsed.number).toBe('RD-1');
    });

    it('accepts a number of exactly 40 characters', () => {
      const number = 'R'.repeat(40);
      expect(registerResolutionRequestSchema.safeParse({ ...request, number }).success).toBe(true);
    });

    it.each(['', '   ', 'R'.repeat(41), 'RD#1', 'RD<1>', 'RD\n1'])(
      'rejects the number %j',
      (number) => {
        expect(registerResolutionRequestSchema.safeParse({ ...request, number }).success).toBe(
          false,
        );
      },
    );

    it.each(['2026-02-30', '2026-13-01', '10/11/2026', '2026-1-1', '', 'hoy'])(
      'rejects the date %j',
      (issuedOn) => {
        expect(registerResolutionRequestSchema.safeParse({ ...request, issuedOn }).success).toBe(
          false,
        );
      },
    );

    it('accepts a leap day and rejects it on a non-leap year', () => {
      expect(
        registerResolutionRequestSchema.safeParse({ ...request, issuedOn: '2028-02-29' }).success,
      ).toBe(true);
      expect(
        registerResolutionRequestSchema.safeParse({ ...request, issuedOn: '2027-02-29' }).success,
      ).toBe(false);
    });

    it.each(['', 'v'.repeat(65)])('rejects the catalog version id %j', (catalogVersionId) => {
      expect(
        registerResolutionRequestSchema.safeParse({ ...request, catalogVersionId }).success,
      ).toBe(false);
    });

    it('rejects an unknown type', () => {
      expect(registerResolutionRequestSchema.safeParse({ ...request, type: 'OTHER' }).success).toBe(
        false,
      );
    });

    it('rejects an unknown field', () => {
      expect(
        registerResolutionRequestSchema.safeParse({ ...request, status: 'APPROVED' }).success,
      ).toBe(false);
    });

    it.each(['type', 'number', 'issuedOn', 'catalogVersionId'])(
      'requires the field %s',
      (field) => {
        const incomplete: Record<string, unknown> = { ...request };
        delete incomplete[field];
        expect(registerResolutionRequestSchema.safeParse(incomplete).success).toBe(false);
      },
    );
  });

  describe('id params', () => {
    it('accepts an id and rejects empty, long or unknown values', () => {
      expect(resolutionIdParamsSchema.safeParse({ id: 'r1' }).success).toBe(true);
      expect(resolutionIdParamsSchema.safeParse({ id: '' }).success).toBe(false);
      expect(resolutionIdParamsSchema.safeParse({ id: 'r'.repeat(65) }).success).toBe(false);
      expect(resolutionIdParamsSchema.safeParse({ id: 'r1', foo: 'x' }).success).toBe(false);
    });
  });

  describe('list query', () => {
    it('applies the defaults', () => {
      const parsed = listResolutionsQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(20);
    });

    it('coerces the query strings and keeps the filters', () => {
      const parsed = listResolutionsQuerySchema.parse({
        page: '3',
        pageSize: '100',
        type: 'GRADUATE_ATTRIBUTE',
        status: 'APPROVED',
        catalogVersionId: 'v1',
      });
      expect(parsed).toEqual({
        page: 3,
        pageSize: 100,
        type: 'GRADUATE_ATTRIBUTE',
        status: 'APPROVED',
        catalogVersionId: 'v1',
      });
    });

    it.each([
      { page: '0' },
      { page: '10001' },
      { pageSize: '0' },
      { pageSize: '101' },
      { page: '1.5' },
      { type: 'OTHER' },
      { status: 'DRAFT' },
      { catalogVersionId: 'v'.repeat(65) },
      { foo: 'x' },
    ])('rejects the query %j', (query) => {
      expect(listResolutionsQuerySchema.safeParse(query).success).toBe(false);
    });
  });

  describe('dto', () => {
    it('accepts a registered resolution without pdf nor approval (incomplete but valid)', () => {
      expect(resolutionDtoSchema.safeParse(dto).success).toBe(true);
    });

    it('accepts an approved resolution', () => {
      const approved = {
        ...dto,
        status: 'APPROVED',
        pdfFileId: 'f1',
        approvedAt: '2026-11-14T09:00:00.000Z',
        approvedBy: 'user-2',
      };
      expect(resolutionDtoSchema.safeParse(approved).success).toBe(true);
    });

    it('accepts an improvement plan resolution without a catalog version', () => {
      expect(
        resolutionDtoSchema.safeParse({ ...dto, type: 'IMPROVEMENT_PLAN', catalogVersionId: null })
          .success,
      ).toBe(true);
    });

    it.each([
      { issuedOn: '2026-02-30' },
      { status: 'DRAFT' },
      { createdAt: 'ayer' },
      { id: '' },
      { extra: 1 },
    ])('rejects the dto change %j', (change) => {
      expect(resolutionDtoSchema.safeParse({ ...dto, ...change }).success).toBe(false);
    });
  });

  describe('list response', () => {
    it('accepts a page of resolutions and rejects unknown fields', () => {
      const page = { items: [dto], page: 1, pageSize: 20, total: 1, totalPages: 1 };
      expect(listResolutionsResponseSchema.safeParse(page).success).toBe(true);
      expect(listResolutionsResponseSchema.safeParse({ ...page, extra: 1 }).success).toBe(false);
      expect(listResolutionsResponseSchema.safeParse({ ...page, total: -1 }).success).toBe(false);
    });
  });

  it('fixes the pdf limit at 10 MiB and the pdf media type', () => {
    expect(RESOLUTION_PDF_MAX_BYTES).toBe(10_485_760);
    expect(RESOLUTION_PDF_MIME_TYPE).toBe('application/pdf');
  });
});
