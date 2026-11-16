import type { StakeholderStatus } from '../entities/stakeholder-enums.js';
import { InvalidStakeholderTransitionError } from '../errors/invalid-stakeholder-transition-error.js';

/** Tabla de transiciones: Activo -> Anulado. Anulado es terminal e inmutable (RS-003). */
export const STAKEHOLDER_TRANSITIONS: Readonly<
  Record<StakeholderStatus, readonly StakeholderStatus[]>
> = {
  ACTIVE: ['VOIDED'],
  VOIDED: [],
};

export function canTransition(from: StakeholderStatus, to: StakeholderStatus): boolean {
  return STAKEHOLDER_TRANSITIONS[from].includes(to);
}

export function assertCanEdit(status: StakeholderStatus): void {
  if (status !== 'ACTIVE') {
    throw new InvalidStakeholderTransitionError('Un constituyente anulado no puede editarse.');
  }
}

export function assertCanVoid(status: StakeholderStatus): void {
  if (!canTransition(status, 'VOIDED')) {
    throw new InvalidStakeholderTransitionError('El constituyente ya se encuentra anulado.');
  }
}
