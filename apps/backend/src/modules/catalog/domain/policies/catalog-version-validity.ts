import type { CatalogVersionStatus } from '../entities/catalog-version-status.js';

/** Una versión del programa con las fechas de aprobación de sus resoluciones OE/AG aprobadas. */
export interface CatalogValidityVersion {
  readonly id: string;
  readonly number: number;
  readonly status: CatalogVersionStatus;
  readonly approvedAts: readonly Date[];
}

export interface CatalogVersionValidity {
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
}

function earliest(dates: readonly Date[]): Date | null {
  let result: Date | null = null;
  for (const date of dates) {
    if (result === null || date.getTime() < result.getTime()) {
      result = date;
    }
  }
  return result;
}

/**
 * Vigencia derivada de las resoluciones (D4 de la HU-017, sin columnas nuevas):
 * - `validFrom`: la menor fecha de aprobación de sus resoluciones OE/AG aprobadas; nulo si no
 *   tiene ninguna (p. ej. la versión 1 sembrada).
 * - `validUntil`: solo una versión Histórica lo tiene; es el `validFrom` de la siguiente versión
 *   del programa (número mayor) que fue activada; nulo si no hay una.
 */
export function deriveVersionValidity(
  versionId: string,
  versions: readonly CatalogValidityVersion[],
): CatalogVersionValidity {
  const version = versions.find((candidate) => candidate.id === versionId);
  if (!version) {
    return { validFrom: null, validUntil: null };
  }

  const validFrom = earliest(version.approvedAts);
  if (version.status !== 'HISTORICAL') {
    return { validFrom, validUntil: null };
  }

  const next = versions
    .filter((candidate) => candidate.number > version.number && earliest(candidate.approvedAts))
    .sort((left, right) => left.number - right.number)[0];
  return { validFrom, validUntil: next ? earliest(next.approvedAts) : null };
}
