import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_CONTENT_MAX_LENGTH,
  listTemplatesQuerySchema,
  listTemplatesResponseSchema,
  publishTemplateRequestSchema,
  saveTemplateDraftRequestSchema,
  templateDetailDtoSchema,
  templateIdParamsSchema,
  templateSummaryDtoSchema,
  templateVariableSchema,
  templateVariablesSchema,
  templateVersionDtoSchema,
} from './templates.js';

const ISO = '2026-11-14T10:00:00.000Z';

const publishedSummary = {
  id: 'v1',
  number: 1,
  status: 'PUBLISHED',
  publishedAt: ISO,
  updatedAt: ISO,
};
const draftSummary = { id: 'v2', number: 2, status: 'DRAFT', publishedAt: null, updatedAt: ISO };
const summary = {
  id: 't1',
  code: 'FO-01',
  name: 'Anexo 1',
  type: 'ANNEX',
  variables: [{ key: 'program.name', label: 'Programa' }],
  published: publishedSummary,
  draft: null,
};

describe('template schemas (T-018-13, RF-018)', () => {
  describe('variables', () => {
    it.each(['a', 'programName', 'program.name', 'a1.b2.c3'])('accepts the key %s', (key) => {
      expect(templateVariableSchema.safeParse({ key, label: 'L' }).success).toBe(true);
    });

    it.each(['', 'Program', '1a', 'a..b', 'a.', '.a', 'a b', 'a-b', 'a'.repeat(61)])(
      'rejects the invalid key [%s]',
      (key) => {
        expect(templateVariableSchema.safeParse({ key, label: 'L' }).success).toBe(false);
      },
    );

    it('rejects an empty label and a label longer than 80 characters', () => {
      expect(templateVariableSchema.safeParse({ key: 'a', label: '' }).success).toBe(false);
      expect(templateVariableSchema.safeParse({ key: 'a', label: 'x'.repeat(81) }).success).toBe(
        false,
      );
      expect(templateVariableSchema.safeParse({ key: 'a', label: 'x'.repeat(80) }).success).toBe(
        true,
      );
    });

    it('rejects unknown fields', () => {
      expect(templateVariableSchema.safeParse({ key: 'a', label: 'L', extra: 1 }).success).toBe(
        false,
      );
    });

    it('accepts an empty list and rejects repeated keys', () => {
      expect(templateVariablesSchema.safeParse([]).success).toBe(true);
      expect(
        templateVariablesSchema.safeParse([
          { key: 'a', label: 'A' },
          { key: 'a', label: 'B' },
        ]).success,
      ).toBe(false);
    });

    it('rejects more than 100 variables', () => {
      const many = Array.from({ length: 101 }, (_, index) => ({ key: `v${index}`, label: 'L' }));
      expect(templateVariablesSchema.safeParse(many).success).toBe(false);
      expect(templateVariablesSchema.safeParse(many.slice(0, 100)).success).toBe(true);
    });
  });

  describe('id params', () => {
    it('accepts an id of 64 characters and rejects 65', () => {
      expect(templateIdParamsSchema.safeParse({ id: 'a'.repeat(64) }).success).toBe(true);
      expect(templateIdParamsSchema.safeParse({ id: 'a'.repeat(65) }).success).toBe(false);
    });

    it('rejects an empty id and unknown fields', () => {
      expect(templateIdParamsSchema.safeParse({ id: '' }).success).toBe(false);
      expect(templateIdParamsSchema.safeParse({ id: 'a', extra: 1 }).success).toBe(false);
    });
  });

  describe('list query', () => {
    it('applies the defaults', () => {
      expect(listTemplatesQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50 });
    });

    it('coerces numeric strings and accepts a type filter', () => {
      expect(
        listTemplatesQuerySchema.parse({ page: '2', pageSize: '100', type: 'SURVEY' }),
      ).toEqual({ page: 2, pageSize: 100, type: 'SURVEY' });
    });

    it.each([{ page: '0' }, { pageSize: '0' }, { pageSize: '101' }, { type: 'OTHER' }, { x: '1' }])(
      'rejects %o',
      (query) => {
        expect(listTemplatesQuerySchema.safeParse(query).success).toBe(false);
      },
    );
  });

  describe('save draft request', () => {
    it('accepts content of exactly the limit and rejects one more character', () => {
      expect(
        saveTemplateDraftRequestSchema.safeParse({
          content: 'a'.repeat(TEMPLATE_CONTENT_MAX_LENGTH),
        }).success,
      ).toBe(true);
      expect(
        saveTemplateDraftRequestSchema.safeParse({
          content: 'a'.repeat(TEMPLATE_CONTENT_MAX_LENGTH + 1),
        }).success,
      ).toBe(false);
    });

    it('rejects empty and whitespace-only content', () => {
      expect(saveTemplateDraftRequestSchema.safeParse({ content: '' }).success).toBe(false);
      expect(saveTemplateDraftRequestSchema.safeParse({ content: ' \n\t ' }).success).toBe(false);
    });

    it('rejects a missing content and unknown fields', () => {
      expect(saveTemplateDraftRequestSchema.safeParse({}).success).toBe(false);
      expect(saveTemplateDraftRequestSchema.safeParse({ content: '<p>x</p>', x: 1 }).success).toBe(
        false,
      );
    });
  });

  describe('publish request', () => {
    it('accepts a version id and trims it', () => {
      expect(publishTemplateRequestSchema.parse({ versionId: ' v2 ' })).toEqual({
        versionId: 'v2',
      });
    });

    it('rejects an empty or oversized version id, a missing one and unknown fields', () => {
      expect(publishTemplateRequestSchema.safeParse({ versionId: '' }).success).toBe(false);
      expect(publishTemplateRequestSchema.safeParse({ versionId: 'a'.repeat(65) }).success).toBe(
        false,
      );
      expect(publishTemplateRequestSchema.safeParse({ versionId: 'v', x: 1 }).success).toBe(false);
      expect(publishTemplateRequestSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('response DTOs', () => {
    it('accepts a template without published version (incomplete but valid)', () => {
      const parsed = templateSummaryDtoSchema.safeParse({
        ...summary,
        published: null,
        draft: draftSummary,
      });
      expect(parsed.success).toBe(true);
    });

    it('accepts a draft whose publishedAt is null and rejects a missing publishedAt', () => {
      expect(
        templateVersionDtoSchema.safeParse({ ...draftSummary, content: '<p>x</p>' }).success,
      ).toBe(true);
      const { publishedAt: _omitted, ...withoutPublishedAt } = draftSummary;
      expect(
        templateVersionDtoSchema.safeParse({ ...withoutPublishedAt, content: '<p>x</p>' }).success,
      ).toBe(false);
    });

    it('rejects an invalid status, a number below 1 and unknown fields', () => {
      expect(
        templateVersionDtoSchema.safeParse({ ...draftSummary, status: 'ARCHIVED', content: 'x' })
          .success,
      ).toBe(false);
      expect(
        templateVersionDtoSchema.safeParse({ ...draftSummary, number: 0, content: 'x' }).success,
      ).toBe(false);
      expect(
        templateVersionDtoSchema.safeParse({ ...draftSummary, content: 'x', extra: 1 }).success,
      ).toBe(false);
    });

    it('parses the detail with its history and contents', () => {
      const detail = {
        id: 't1',
        code: 'FO-01',
        name: 'Anexo 1',
        type: 'ANNEX',
        variables: [],
        versions: [draftSummary, publishedSummary],
        published: { ...publishedSummary, content: '<p>v1</p>' },
        draft: { ...draftSummary, content: '<p>v2</p>' },
      };
      expect(templateDetailDtoSchema.safeParse(detail).success).toBe(true);
      expect(
        templateDetailDtoSchema.safeParse({ ...detail, published: null, draft: null }).success,
      ).toBe(true);
    });

    it('parses a paginated list and rejects negative totals and page 0', () => {
      const response = { items: [summary], page: 1, pageSize: 50, total: 1, totalPages: 1 };
      expect(listTemplatesResponseSchema.safeParse(response).success).toBe(true);
      expect(listTemplatesResponseSchema.safeParse({ ...response, total: -1 }).success).toBe(false);
      expect(listTemplatesResponseSchema.safeParse({ ...response, page: 0 }).success).toBe(false);
    });
  });
});
