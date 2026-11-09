import { describe, expect, it } from 'vitest';
import { computeEffectivePermissions } from './effective-permissions.js';
import { evaluateResourceAccess } from './evaluate-resource-access.js';

describe('evaluateResourceAccess (RS-011, RF-008)', () => {
  it('denies an OWN grant when the actor is not the owner', () => {
    const effective = computeEffectivePermissions([
      { permission: 'medicion_curso.ver', scope: 'OWN' },
    ]);

    const result = evaluateResourceAccess({
      effective,
      permission: 'medicion_curso.ver',
      ownership: 'NOT_OWNER',
    });

    expect(result).toEqual({
      allowed: false,
      reason: 'NOT_OWNER',
    });
  });

  it('allows an OWN grant when the actor is the owner', () => {
    const effective = computeEffectivePermissions([
      { permission: 'medicion_curso.ver', scope: 'OWN' },
    ]);

    const result = evaluateResourceAccess({
      effective,
      permission: 'medicion_curso.ver',
      ownership: 'OWNER',
    });

    expect(result).toEqual({
      allowed: true,
    });
  });

  it('allows a GLOBAL grant without requiring ownership', () => {
    const effective = computeEffectivePermissions([
      { permission: 'medicion_curso.ver', scope: 'GLOBAL' },
    ]);

    const result = evaluateResourceAccess({
      effective,
      permission: 'medicion_curso.ver',
    });

    expect(result).toEqual({
      allowed: true,
    });
  });
});
