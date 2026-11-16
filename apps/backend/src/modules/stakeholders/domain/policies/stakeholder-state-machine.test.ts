import { describe, expect, it } from 'vitest';
import { InvalidStakeholderTransitionError } from '../errors/invalid-stakeholder-transition-error.js';
import { assertCanEdit, assertCanVoid, canTransition } from './stakeholder-state-machine.js';

describe('stakeholder-state-machine', () => {
  it('allows ACTIVE -> VOIDED and forbids any transition from VOIDED', () => {
    expect(canTransition('ACTIVE', 'VOIDED')).toBe(true);
    expect(canTransition('VOIDED', 'ACTIVE')).toBe(false);
    expect(canTransition('VOIDED', 'VOIDED')).toBe(false);
  });

  it('allows editing and voiding only when ACTIVE', () => {
    expect(() => assertCanEdit('ACTIVE')).not.toThrow();
    expect(() => assertCanVoid('ACTIVE')).not.toThrow();

    expect(() => assertCanEdit('VOIDED')).toThrow(InvalidStakeholderTransitionError);
    expect(() => assertCanVoid('VOIDED')).toThrow(InvalidStakeholderTransitionError);
  });
});
