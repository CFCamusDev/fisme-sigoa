import type { CatalogVersionDto, ProcessTypeValue } from '@sigoa/shared';

/**
 * Mapa local espejo de la regla de dominio del backend (RS-023):
 * - Procesos de validación (P611, P613, P621) → versión en estado `IN_VALIDATION`.
 * - Procesos de medición (P612, P622, P623) → versión vigente (`APPROVED`).
 * El servidor sigue siendo la autoridad vinculante (responde 409 si no coincide).
 */
export const REQUIRED_CATALOG_VERSION_STATUS_BY_PROCESS: Record<
  ProcessTypeValue,
  'IN_VALIDATION' | 'APPROVED'
> = {
  P611: 'IN_VALIDATION',
  P612: 'APPROVED',
  P613: 'IN_VALIDATION',
  P621: 'IN_VALIDATION',
  P622: 'APPROVED',
  P623: 'APPROVED',
};

export function filterEligibleCatalogVersions(
  type: ProcessTypeValue | '',
  versions: readonly CatalogVersionDto[],
): CatalogVersionDto[] {
  if (!type) {
    return [];
  }
  const required = REQUIRED_CATALOG_VERSION_STATUS_BY_PROCESS[type];
  return versions.filter((version) => version.status === required);
}

export function formatCatalogVersionOptionLabel(version: CatalogVersionDto): string {
  const statusLabel = version.status === 'IN_VALIDATION' ? 'En validación' : 'Vigente';
  return `v${version.number} · ${statusLabel}`;
}

export function getRequiredVersionLabel(type: ProcessTypeValue | ''): string {
  if (!type) {
    return '';
  }
  return REQUIRED_CATALOG_VERSION_STATUS_BY_PROCESS[type] === 'IN_VALIDATION'
    ? 'En validación'
    : 'Vigente';
}

export function requiresValidationVersion(type: ProcessTypeValue | ''): boolean {
  return (
    Boolean(type) &&
    REQUIRED_CATALOG_VERSION_STATUS_BY_PROCESS[type as ProcessTypeValue] === 'IN_VALIDATION'
  );
}
