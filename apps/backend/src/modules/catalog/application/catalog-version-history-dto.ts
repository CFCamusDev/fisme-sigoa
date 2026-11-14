import type { CatalogVersionHistoryDto } from '@sigoa/shared';
import type { CatalogVersion } from '../domain/entities/catalog-version.js';
import {
  deriveVersionValidity,
  type CatalogValidityVersion,
} from '../domain/policies/catalog-version-validity.js';
import type { CatalogVersionResolutionRecord } from '../domain/ports/catalog-version-history-reader.js';

type ResolutionsByVersion = ReadonlyMap<string, readonly CatalogVersionResolutionRecord[]>;

/** Fechas de aprobación de las resoluciones OE/AG aprobadas de una versión. */
function approvedDates(records: readonly CatalogVersionResolutionRecord[] | undefined): Date[] {
  return (records ?? [])
    .filter((record) => record.status === 'APPROVED' && record.approvedAt !== null)
    .map((record) => record.approvedAt as Date);
}

/**
 * Resolución y vigencia de una versión (D4 de la HU-017). `programVersions` son todas las
 * versiones del programa: la vigencia final sale de la siguiente versión activada.
 */
export function buildVersionHistoryDto(
  versionId: string,
  programVersions: readonly CatalogVersion[],
  resolutionsByVersion: ResolutionsByVersion,
): CatalogVersionHistoryDto {
  const validityInput: CatalogValidityVersion[] = programVersions.map((version) => ({
    id: version.id,
    number: version.number,
    status: version.status,
    approvedAts: approvedDates(resolutionsByVersion.get(version.id)),
  }));
  const validity = deriveVersionValidity(versionId, validityInput);

  return {
    validFrom: validity.validFrom?.toISOString() ?? null,
    validUntil: validity.validUntil?.toISOString() ?? null,
    resolutions: (resolutionsByVersion.get(versionId) ?? []).map((record) => ({
      id: record.id,
      type: record.type,
      number: record.number,
      issuedOn: record.issuedOn.toISOString().slice(0, 10),
      status: record.status,
      approvedAt: record.approvedAt?.toISOString() ?? null,
      hasPdf: record.hasPdf,
    })),
  };
}
