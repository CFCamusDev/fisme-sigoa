import type { TemplateVersionStatus } from '../entities/template-version-status.js';
import { InvalidTemplateTransitionError } from '../errors/invalid-template-transition-error.js';

/** Permiso que exige cada transición; `null` = efecto de publicar otra versión, sin permiso propio. */
export type TemplateTransitionPermission = 'plantilla.publicar' | null;

/** Tabla de RS 5: Borrador → Publicada → Obsoleta. */
export const TEMPLATE_VERSION_TRANSITIONS: Readonly<
  Record<TemplateVersionStatus, readonly TemplateVersionStatus[]>
> = {
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['OBSOLETE'],
  OBSOLETE: [],
};

export function canTransition(from: TemplateVersionStatus, to: TemplateVersionStatus): boolean {
  return TEMPLATE_VERSION_TRANSITIONS[from].includes(to);
}

export function requiredPermission(
  from: TemplateVersionStatus,
  to: TemplateVersionStatus,
): TemplateTransitionPermission {
  if (!canTransition(from, to)) {
    throw new InvalidTemplateTransitionError();
  }
  return from === 'DRAFT' ? 'plantilla.publicar' : null;
}

/** Función pura: valida la transición; no consulta permisos ni persiste. */
export function assertTransition(from: TemplateVersionStatus, to: TemplateVersionStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTemplateTransitionError();
  }
}
