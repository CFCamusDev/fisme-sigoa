import { describe, expect, it } from 'vitest';
import { computeEffectivePermissions } from './effective-permissions.js';
import {
  evaluateResourceAccess,
  type EvaluateResourceAccessResult,
  type ResourceOwnershipEvaluationInput,
} from './evaluate-resource-access.js';

describe('evaluateResourceAccess (RS-011, RF-008, RNF-030)', () => {
  it('denies with MISSING_PERMISSION when the actor lacks any grant for the permission', () => {
    const effective = computeEffectivePermissions([{ permission: 'curso.ver', scope: 'GLOBAL' }]);

    expect(
      evaluateResourceAccess({
        effective,
        permission: 'medicion_curso.ver',
        ownership: 'OWNER',
      }),
    ).toEqual({
      allowed: false,
      reason: 'MISSING_PERMISSION',
    });
  });

  it('denies an OWN grant when the actor is not the owner', () => {
    const effective = computeEffectivePermissions([
      { permission: 'medicion_curso.ver', scope: 'OWN' },
    ]);

    expect(
      evaluateResourceAccess({
        effective,
        permission: 'medicion_curso.ver',
        ownership: 'NOT_OWNER',
      }),
    ).toEqual({
      allowed: false,
      reason: 'NOT_OWNER',
    });
  });

  it('denies an OWN grant with NOT_OWNER when the resource is NOT_FOUND to prevent enumeration', () => {
    const effective = computeEffectivePermissions([
      { permission: 'medicion_curso.ver', scope: 'OWN' },
    ]);

    expect(
      evaluateResourceAccess({
        effective,
        permission: 'medicion_curso.ver',
        ownership: 'NOT_FOUND',
      }),
    ).toEqual({
      allowed: false,
      reason: 'NOT_OWNER',
    });
  });

  it('denies an OWN grant with NOT_OWNER when ownership is omitted (fail-closed)', () => {
    const effective = computeEffectivePermissions([
      { permission: 'medicion_curso.ver', scope: 'OWN' },
    ]);

    expect(
      evaluateResourceAccess({
        effective,
        permission: 'medicion_curso.ver',
      }),
    ).toEqual({
      allowed: false,
      reason: 'NOT_OWNER',
    });
  });

  it('denies an OWN grant with UNKNOWN_RESOURCE_TYPE when the resource type is not registered', () => {
    const effective = computeEffectivePermissions([
      { permission: 'medicion_curso.ver', scope: 'OWN' },
    ]);

    expect(
      evaluateResourceAccess({
        effective,
        permission: 'medicion_curso.ver',
        ownership: 'UNKNOWN_RESOURCE_TYPE',
      }),
    ).toEqual({
      allowed: false,
      reason: 'UNKNOWN_RESOURCE_TYPE',
    });
  });

  it('allows an OWN grant when the actor is the owner', () => {
    const effective = computeEffectivePermissions([
      { permission: 'medicion_curso.ver', scope: 'OWN' },
    ]);

    expect(
      evaluateResourceAccess({
        effective,
        permission: 'medicion_curso.ver',
        ownership: 'OWNER',
      }),
    ).toEqual({
      allowed: true,
    });
  });

  it('allows a GLOBAL grant without requiring ownership even if ownership is NOT_OWNER or NOT_FOUND', () => {
    const effective = computeEffectivePermissions([
      { permission: 'medicion_curso.ver', scope: 'GLOBAL' },
    ]);

    expect(
      evaluateResourceAccess({
        effective,
        permission: 'medicion_curso.ver',
      }),
    ).toEqual({
      allowed: true,
    });

    expect(
      evaluateResourceAccess({
        effective,
        permission: 'medicion_curso.ver',
        ownership: 'NOT_OWNER',
      }),
    ).toEqual({
      allowed: true,
    });

    expect(
      evaluateResourceAccess({
        effective,
        permission: 'medicion_curso.ver',
        ownership: 'NOT_FOUND',
      }),
    ).toEqual({
      allowed: true,
    });
  });

  it('allows when the actor has both OWN and GLOBAL grants for the same permission (RS-012 precedence)', () => {
    const effective = computeEffectivePermissions([
      { permission: 'medicion_curso.editar', scope: 'OWN' },
      { permission: 'medicion_curso.editar', scope: 'GLOBAL' },
    ]);

    expect(
      evaluateResourceAccess({
        effective,
        permission: 'medicion_curso.editar',
        ownership: 'NOT_OWNER',
      }),
    ).toEqual({
      allowed: true,
    });
  });

  it.each<{
    readonly grant: 'NONE' | 'OWN' | 'GLOBAL';
    readonly ownership: ResourceOwnershipEvaluationInput | undefined;
    readonly expected: EvaluateResourceAccessResult;
  }>([
    {
      grant: 'NONE',
      ownership: 'OWNER',
      expected: { allowed: false, reason: 'MISSING_PERMISSION' },
    },
    {
      grant: 'NONE',
      ownership: 'NOT_OWNER',
      expected: { allowed: false, reason: 'MISSING_PERMISSION' },
    },
    {
      grant: 'NONE',
      ownership: 'NOT_FOUND',
      expected: { allowed: false, reason: 'MISSING_PERMISSION' },
    },
    {
      grant: 'NONE',
      ownership: 'UNKNOWN_RESOURCE_TYPE',
      expected: { allowed: false, reason: 'MISSING_PERMISSION' },
    },
    {
      grant: 'OWN',
      ownership: 'OWNER',
      expected: { allowed: true },
    },
    {
      grant: 'OWN',
      ownership: 'NOT_OWNER',
      expected: { allowed: false, reason: 'NOT_OWNER' },
    },
    {
      grant: 'OWN',
      ownership: 'NOT_FOUND',
      expected: { allowed: false, reason: 'NOT_OWNER' },
    },
    {
      grant: 'OWN',
      ownership: 'UNKNOWN_RESOURCE_TYPE',
      expected: { allowed: false, reason: 'UNKNOWN_RESOURCE_TYPE' },
    },
    {
      grant: 'OWN',
      ownership: undefined,
      expected: { allowed: false, reason: 'NOT_OWNER' },
    },
    {
      grant: 'GLOBAL',
      ownership: 'OWNER',
      expected: { allowed: true },
    },
    {
      grant: 'GLOBAL',
      ownership: 'NOT_OWNER',
      expected: { allowed: true },
    },
    {
      grant: 'GLOBAL',
      ownership: 'NOT_FOUND',
      expected: { allowed: true },
    },
    {
      grant: 'GLOBAL',
      ownership: 'UNKNOWN_RESOURCE_TYPE',
      expected: { allowed: true },
    },
  ])(
    'evaluates matrix case grant=$grant ownership=$ownership -> $expected',
    ({ grant, ownership, expected }) => {
      const effective = computeEffectivePermissions(
        grant === 'NONE' ? [] : [{ permission: 'medicion_curso.ver', scope: grant }],
      );

      expect(
        evaluateResourceAccess({
          effective,
          permission: 'medicion_curso.ver',
          ...(ownership !== undefined ? { ownership } : {}),
        }),
      ).toEqual(expected);
    },
  );
});
