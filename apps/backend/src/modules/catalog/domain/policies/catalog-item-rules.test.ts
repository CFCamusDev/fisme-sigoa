import { describe, expect, it } from 'vitest';
import { CATALOG_MAX_ITEMS } from '../entities/catalog-limits.js';
import {
  CatalogItemLimitReachedError,
  CatalogOrderMismatchError,
  CatalogVersionNotEditableError,
  DuplicateCatalogCodeError,
} from '../errors/index.js';
import {
  assertCanAddItem,
  assertCodeAvailable,
  assertVersionEditable,
  planReorder,
} from './catalog-item-rules.js';

const items = [
  { id: 'a', code: 'AG-C01', order: 1 },
  { id: 'b', code: 'AG-C02', order: 2 },
  { id: 'c', code: 'AG-C03', order: 3 },
];

describe('catalog item rules (T-014-11, RF-014, RS-020)', () => {
  describe('assertVersionEditable', () => {
    it('accepts a draft version', () => {
      expect(() => assertVersionEditable('DRAFT')).not.toThrow();
    });

    it.each(['IN_VALIDATION', 'APPROVED', 'HISTORICAL'] as const)(
      'rejects editing a version that is not a draft (%s)',
      (status) => {
        expect(() => assertVersionEditable(status)).toThrow(CatalogVersionNotEditableError);
      },
    );
  });

  describe('assertCodeAvailable', () => {
    it('accepts a code that is not used in the version', () => {
      expect(() => assertCodeAvailable('AG-C04', items)).not.toThrow();
    });

    it('rejects a code already used in the version', () => {
      expect(() => assertCodeAvailable('AG-C02', items)).toThrow(DuplicateCatalogCodeError);
    });

    it('allows an item to keep its own code when it is excluded', () => {
      expect(() => assertCodeAvailable('AG-C02', items, 'b')).not.toThrow();
    });

    it('still rejects the code of another item when editing', () => {
      expect(() => assertCodeAvailable('AG-C01', items, 'b')).toThrow(DuplicateCatalogCodeError);
    });
  });

  describe('assertCanAddItem', () => {
    it('accepts adding while below the limit', () => {
      expect(() => assertCanAddItem(CATALOG_MAX_ITEMS - 1)).not.toThrow();
    });

    it('rejects adding when the limit of items is reached', () => {
      expect(() => assertCanAddItem(CATALOG_MAX_ITEMS)).toThrow(CatalogItemLimitReachedError);
    });
  });

  describe('planReorder', () => {
    it('returns consecutive orders starting at 1 following the requested ids', () => {
      expect(planReorder(items, ['c', 'a', 'b'])).toEqual([
        { id: 'c', order: 1 },
        { id: 'a', order: 2 },
        { id: 'b', order: 3 },
      ]);
    });

    it('rejects a list with a missing id', () => {
      expect(() => planReorder(items, ['a', 'b'])).toThrow(CatalogOrderMismatchError);
    });

    it('rejects a list with an extra unknown id', () => {
      expect(() => planReorder(items, ['a', 'b', 'c', 'z'])).toThrow(CatalogOrderMismatchError);
    });

    it('rejects a list with a repeated id', () => {
      expect(() => planReorder(items, ['a', 'a', 'b'])).toThrow(CatalogOrderMismatchError);
    });

    it('rejects a list of the same size with a foreign id', () => {
      expect(() => planReorder(items, ['a', 'b', 'z'])).toThrow(CatalogOrderMismatchError);
    });

    it('accepts an empty list for an empty version', () => {
      expect(planReorder([], [])).toEqual([]);
    });
  });
});
