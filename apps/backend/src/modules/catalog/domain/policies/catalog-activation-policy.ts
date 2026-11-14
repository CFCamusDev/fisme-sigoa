import type { CatalogVersion } from '../entities/catalog-version.js';
import { InvalidCatalogTransitionError } from '../errors/invalid-catalog-transition-error.js';

export type CatalogActivationPlan =
  | { readonly outcome: 'ACTIVATE'; readonly supersedeVersionId: string | null }
  | { readonly outcome: 'ALREADY_CURRENT' };

export interface PlanActivationInput {
  /** Versión que la resolución aprobada activa. */
  readonly candidate: CatalogVersion;
  /** Versión vigente (Aprobada) del programa antes de activar, si existe. */
  readonly current: CatalogVersion | null;
}

/**
 * Política pura de RF-016: una sola versión vigente por programa. Primero se degrada la anterior
 * y después se aprueba la candidata, porque el índice único parcial de BD no es diferible.
 */
export function planActivation(input: PlanActivationInput): CatalogActivationPlan {
  const { candidate, current } = input;

  if (candidate.status === 'APPROVED') {
    return { outcome: 'ALREADY_CURRENT' };
  }
  if (candidate.status !== 'IN_VALIDATION') {
    throw new InvalidCatalogTransitionError(
      'Solo una versión en validación puede activarse con una resolución aprobada.',
    );
  }
  if (!current) {
    return { outcome: 'ACTIVATE', supersedeVersionId: null };
  }
  if (current.programId !== candidate.programId || current.status !== 'APPROVED') {
    throw new InvalidCatalogTransitionError(
      'La versión vigente no corresponde al programa de la versión que se activa.',
    );
  }
  return { outcome: 'ACTIVATE', supersedeVersionId: current.id };
}
