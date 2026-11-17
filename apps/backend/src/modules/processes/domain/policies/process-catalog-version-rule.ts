import { PROCESS_TYPE_RULES, type ProcessType } from '../entities/process-type.js';
import { CatalogVersionNotAllowedError } from '../errors/catalog-version-not-allowed-error.js';

export type ProcessCatalogVersionStatus = 'DRAFT' | 'IN_VALIDATION' | 'APPROVED' | 'HISTORICAL';

export interface ProcessCatalogVersionRef {
  readonly id: string;
  readonly programId: string;
  readonly status: ProcessCatalogVersionStatus;
}

export function requiredCatalogVersionStatus(type: ProcessType): 'IN_VALIDATION' | 'APPROVED' {
  const rule = PROCESS_TYPE_RULES[type];
  return rule.family === 'VALIDATION' ? 'IN_VALIDATION' : 'APPROVED';
}

export function assertCatalogVersionAllowed(
  type: ProcessType,
  version: ProcessCatalogVersionRef,
  programId: string,
): void {
  if (version.programId !== programId) {
    throw new CatalogVersionNotAllowedError(
      'La versión de catálogo seleccionada no pertenece al programa vigente',
    );
  }

  const required = requiredCatalogVersionStatus(type);
  if (version.status !== required) {
    const requiredLabel = required === 'IN_VALIDATION' ? 'En validación' : 'Vigente';
    throw new CatalogVersionNotAllowedError(
      `El proceso ${type} solo admite una versión de catálogo en estado «${requiredLabel}»`,
    );
  }
}
