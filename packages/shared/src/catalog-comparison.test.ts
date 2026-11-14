import { describe, expect, it } from 'vitest';
import {
  catalogComparisonDtoSchema,
  catalogComparisonParamsSchema,
  catalogComparisonQuerySchema,
  catalogVersionHistoryDtoSchema,
} from './catalog-comparison.js';

const version = {
  id: 'v1',
  programId: 'p1',
  number: 1,
  status: 'HISTORICAL',
  basedOnVersionId: null,
  objectiveCount: 1,
  attributeCount: 0,
  createdAt: '2026-11-12T10:00:00.000Z',
};

const emptyHistory = { validFrom: null, validUntil: null, resolutions: [] };

const comparison = {
  base: { version, history: emptyHistory },
  target: {
    version: { ...version, id: 'v2', number: 2, status: 'APPROVED' },
    history: emptyHistory,
  },
  summary: { added: 1, removed: 0, modified: 0, unchanged: 0 },
  objectives: [
    {
      code: 'OEP1',
      change: 'ADDED',
      base: null,
      target: { statement: 'Texto.' },
      nameSegments: [],
      statementSegments: [{ type: 'ADDED', text: 'Texto.' }],
    },
  ],
  attributes: [],
};

describe('catalog comparison schemas (T-017-03, RF-017)', () => {
  describe('params', () => {
    it('accepts two identifiers', () => {
      expect(catalogComparisonParamsSchema.safeParse({ baseId: 'a', targetId: 'b' }).success).toBe(
        true,
      );
    });

    it.each([
      { baseId: 'a' },
      { baseId: '', targetId: 'b' },
      { baseId: 'a', targetId: 'x'.repeat(65) },
      { baseId: 'a', targetId: 'b', extra: 'c' },
    ])('rejects %j', (params) => {
      expect(catalogComparisonParamsSchema.safeParse(params).success).toBe(false);
    });
  });

  describe('query', () => {
    it('accepts an empty query and rejects unknown fields', () => {
      expect(catalogComparisonQuerySchema.safeParse({}).success).toBe(true);
      expect(catalogComparisonQuerySchema.safeParse({ page: '1' }).success).toBe(false);
    });
  });

  describe('response', () => {
    it('parses a response with null dates and no resolutions', () => {
      expect(catalogComparisonDtoSchema.safeParse(comparison).success).toBe(true);
    });

    it('parses a history with a resolution that has no approval date', () => {
      const history = {
        validFrom: '2024-03-01T00:00:00.000Z',
        validUntil: null,
        resolutions: [
          {
            id: 'r1',
            type: 'EDUCATIONAL_OBJECTIVE',
            number: '128-2024',
            issuedOn: '2024-03-01',
            status: 'REGISTERED',
            approvedAt: null,
            hasPdf: false,
          },
        ],
      };

      expect(catalogVersionHistoryDtoSchema.safeParse(history).success).toBe(true);
    });

    it('rejects a history with a date that is not in calendar format', () => {
      const history = {
        ...emptyHistory,
        resolutions: [
          {
            id: 'r1',
            type: 'EDUCATIONAL_OBJECTIVE',
            number: '128-2024',
            issuedOn: '01/03/2024',
            status: 'APPROVED',
            approvedAt: null,
            hasPdf: true,
          },
        ],
      };

      expect(catalogVersionHistoryDtoSchema.safeParse(history).success).toBe(false);
    });

    it('rejects unknown fields such as personal data', () => {
      const withAuthor = {
        ...comparison,
        base: { ...comparison.base, version: { ...version, createdBy: 'user-1' } },
      };

      expect(catalogComparisonDtoSchema.safeParse(withAuthor).success).toBe(false);
    });

    it('rejects an invalid change kind', () => {
      const invalid = {
        ...comparison,
        objectives: [{ ...comparison.objectives[0], change: 'MOVED' }],
      };

      expect(catalogComparisonDtoSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
