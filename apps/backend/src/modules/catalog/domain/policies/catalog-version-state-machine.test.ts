import { describe, expect, it } from 'vitest';
import {
  CATALOG_VERSION_STATUSES,
  type CatalogVersionStatus,
} from '../entities/catalog-version.js';
import { InvalidCatalogTransitionError } from '../errors/index.js';
import {
  assertTransition,
  canTransition,
  CATALOG_VERSION_TRANSITIONS,
  requiredPermission,
} from './catalog-version-state-machine.js';

const VALID: ReadonlyArray<[CatalogVersionStatus, CatalogVersionStatus]> = [
  ['DRAFT', 'IN_VALIDATION'],
  ['IN_VALIDATION', 'APPROVED'],
  ['APPROVED', 'HISTORICAL'],
];

const INVALID = CATALOG_VERSION_STATUSES.flatMap((from) =>
  CATALOG_VERSION_STATUSES.map((to) => [from, to] as const),
).filter(([from, to]) => !VALID.some(([f, t]) => f === from && t === to));

const READY = { objectiveCount: 4, attributeCount: 12, approvedResolution: true };

describe('catalog version state machine', () => {
  it.each(VALID)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition({ from, to, ...READY })).not.toThrow();
  });

  it('covers every status in the transition table', () => {
    expect(Object.keys(CATALOG_VERSION_TRANSITIONS).sort()).toEqual(
      [...CATALOG_VERSION_STATUSES].sort(),
    );
  });

  it.each(INVALID)(
    'rejects %s → %s (jumps, regressions, identity and exits from HISTORICAL)',
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
      expect(() => assertTransition({ from, to, ...READY })).toThrow(InvalidCatalogTransitionError);
      expect(() => requiredPermission(from, to)).toThrow(InvalidCatalogTransitionError);
    },
  );

  it('never leaves HISTORICAL', () => {
    expect(CATALOG_VERSION_TRANSITIONS.HISTORICAL).toHaveLength(0);
  });

  it.each([
    { objectiveCount: 0, attributeCount: 12 },
    { objectiveCount: 4, attributeCount: 0 },
    { objectiveCount: 0, attributeCount: 0 },
  ])('requires at least one objective and one attribute to enter validation: %j', (counts) => {
    expect(() =>
      assertTransition({
        from: 'DRAFT',
        to: 'IN_VALIDATION',
        approvedResolution: false,
        ...counts,
      }),
    ).toThrow(InvalidCatalogTransitionError);
  });

  it('accepts entering validation with exactly one objective and one attribute', () => {
    expect(() =>
      assertTransition({
        from: 'DRAFT',
        to: 'IN_VALIDATION',
        objectiveCount: 1,
        attributeCount: 1,
        approvedResolution: false,
      }),
    ).not.toThrow();
  });

  it('requires an approved resolution to approve', () => {
    expect(() =>
      assertTransition({
        from: 'IN_VALIDATION',
        to: 'APPROVED',
        ...READY,
        approvedResolution: false,
      }),
    ).toThrow(InvalidCatalogTransitionError);
  });

  it('does not require content or resolution to retire the approved version', () => {
    expect(() =>
      assertTransition({
        from: 'APPROVED',
        to: 'HISTORICAL',
        objectiveCount: 0,
        attributeCount: 0,
        approvedResolution: false,
      }),
    ).not.toThrow();
  });

  it('maps each transition to its permission', () => {
    expect(requiredPermission('DRAFT', 'IN_VALIDATION')).toBe('catalogo.editar');
    expect(requiredPermission('IN_VALIDATION', 'APPROVED')).toBe('resolucion.aprobar');
    expect(requiredPermission('APPROVED', 'HISTORICAL')).toBeNull();
  });
});
