import type { CatalogVersionStatus } from '../entities/catalog-version-status.js';
import { InvalidCatalogTransitionError } from '../errors/invalid-catalog-transition-error.js';

/** Permiso que exige cada transición; `null` = efecto de otra transición, sin permiso propio. */
export type CatalogTransitionPermission = 'catalogo.editar' | 'resolucion.aprobar' | null;

/** Tabla de RS 5.3: Borrador → En validación → Aprobada → Histórica. */
export const CATALOG_VERSION_TRANSITIONS: Readonly<
  Record<CatalogVersionStatus, readonly CatalogVersionStatus[]>
> = {
  DRAFT: ['IN_VALIDATION'],
  IN_VALIDATION: ['APPROVED'],
  APPROVED: ['HISTORICAL'],
  HISTORICAL: [],
};

export function canTransition(from: CatalogVersionStatus, to: CatalogVersionStatus): boolean {
  return CATALOG_VERSION_TRANSITIONS[from].includes(to);
}

export function requiredPermission(
  from: CatalogVersionStatus,
  to: CatalogVersionStatus,
): CatalogTransitionPermission {
  if (!canTransition(from, to)) {
    throw new InvalidCatalogTransitionError();
  }
  if (from === 'DRAFT') return 'catalogo.editar';
  if (from === 'IN_VALIDATION') return 'resolucion.aprobar';
  return null;
}

export interface AssertTransitionInput {
  from: CatalogVersionStatus;
  to: CatalogVersionStatus;
  objectiveCount: number;
  attributeCount: number;
  approvedResolution: boolean;
}

/** Función pura: valida la transición y sus precondiciones; no consulta permisos ni persiste. */
export function assertTransition(input: AssertTransitionInput): void {
  if (!canTransition(input.from, input.to)) {
    throw new InvalidCatalogTransitionError();
  }
  if (input.to === 'IN_VALIDATION' && (input.objectiveCount < 1 || input.attributeCount < 1)) {
    throw new InvalidCatalogTransitionError(
      'La versión necesita al menos un objetivo educacional y un atributo del graduado para pasar a validación.',
    );
  }
  if (input.to === 'APPROVED' && !input.approvedResolution) {
    throw new InvalidCatalogTransitionError(
      'La versión solo puede aprobarse con una resolución aprobada.',
    );
  }
}
