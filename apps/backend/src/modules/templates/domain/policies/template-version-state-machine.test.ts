import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_VERSION_STATUSES,
  type TemplateVersionStatus,
} from '../entities/template-version-status.js';
import { InvalidTemplateTransitionError } from '../errors/index.js';
import {
  assertTransition,
  canTransition,
  requiredPermission,
  TEMPLATE_VERSION_TRANSITIONS,
} from './template-version-state-machine.js';

const VALID: ReadonlyArray<[TemplateVersionStatus, TemplateVersionStatus]> = [
  ['DRAFT', 'PUBLISHED'],
  ['PUBLISHED', 'OBSOLETE'],
];

const INVALID = TEMPLATE_VERSION_STATUSES.flatMap((from) =>
  TEMPLATE_VERSION_STATUSES.map((to) => [from, to] as const),
).filter(([from, to]) => !VALID.some(([f, t]) => f === from && t === to));

describe('template version state machine', () => {
  it.each(VALID)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it('covers every status in the transition table', () => {
    expect(Object.keys(TEMPLATE_VERSION_TRANSITIONS).sort()).toEqual(
      [...TEMPLATE_VERSION_STATUSES].sort(),
    );
  });

  it('publishing a draft is the only way to reach PUBLISHED', () => {
    const reachingPublished = TEMPLATE_VERSION_STATUSES.filter((from) =>
      canTransition(from, 'PUBLISHED'),
    );
    expect(reachingPublished).toEqual(['DRAFT']);
  });

  it('keeps OBSOLETE terminal', () => {
    expect(TEMPLATE_VERSION_TRANSITIONS.OBSOLETE).toEqual([]);
  });

  it.each(INVALID)(
    'rejects %s → %s (jumps, regressions, identity and exits from OBSOLETE)',
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
      expect(() => assertTransition(from, to)).toThrow(InvalidTemplateTransitionError);
      expect(() => requiredPermission(from, to)).toThrow(InvalidTemplateTransitionError);
    },
  );

  it('requires plantilla.publicar to publish a draft', () => {
    expect(requiredPermission('DRAFT', 'PUBLISHED')).toBe('plantilla.publicar');
  });

  it('needs no own permission to obsolete a published version (effect of publishing another)', () => {
    expect(requiredPermission('PUBLISHED', 'OBSOLETE')).toBeNull();
  });
});
