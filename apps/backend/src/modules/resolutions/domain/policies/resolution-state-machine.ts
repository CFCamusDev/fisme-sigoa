import type { ResolutionStatus } from '../entities/resolution-enums.js';
import { InvalidResolutionTransitionError } from '../errors/invalid-resolution-transition-error.js';
import { ResolutionPdfRequiredError } from '../errors/resolution-pdf-required-error.js';

export type ResolutionTransitionPermission = 'resolucion.aprobar';

/** Tabla de RS 5.8: Registrada → Aprobada. Una resolución aprobada es inmutable (RN-007). */
export const RESOLUTION_TRANSITIONS: Readonly<
  Record<ResolutionStatus, readonly ResolutionStatus[]>
> = {
  REGISTERED: ['APPROVED'],
  APPROVED: [],
};

export function canTransition(from: ResolutionStatus, to: ResolutionStatus): boolean {
  return RESOLUTION_TRANSITIONS[from].includes(to);
}

export function requiredPermission(
  from: ResolutionStatus,
  to: ResolutionStatus,
): ResolutionTransitionPermission {
  if (!canTransition(from, to)) {
    throw new InvalidResolutionTransitionError();
  }
  return 'resolucion.aprobar';
}

export interface AssertResolutionTransitionInput {
  from: ResolutionStatus;
  to: ResolutionStatus;
  hasSignedPdf: boolean;
}

/** Función pura: valida la transición y su precondición (PDF firmado); no consulta permisos. */
export function assertTransition(input: AssertResolutionTransitionInput): void {
  if (!canTransition(input.from, input.to)) {
    throw new InvalidResolutionTransitionError(
      input.from === 'APPROVED'
        ? 'La resolución ya está aprobada y no puede modificarse.'
        : undefined,
    );
  }
  if (input.to === 'APPROVED' && !input.hasSignedPdf) {
    throw new ResolutionPdfRequiredError();
  }
}
