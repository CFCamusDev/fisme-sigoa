import type { CatalogVersionDto, ListCatalogVersionsResponse } from '@sigoa/shared';

export function buildCatalogVersion(overrides: Partial<CatalogVersionDto> = {}): CatalogVersionDto {
  return {
    id: 'cv-1',
    programId: 'program-1',
    number: 1,
    status: 'APPROVED',
    basedOnVersionId: null,
    objectiveCount: 4,
    attributeCount: 12,
    createdAt: '2026-11-01T15:00:00.000Z',
    ...overrides,
  };
}

/** Versión 1 vigente; con `open` se agrega la versión 2 abierta que parte de ella. */
export function buildCatalogVersionsResponse(
  options: { open?: 'DRAFT' | 'IN_VALIDATION' } = {},
): ListCatalogVersionsResponse {
  const current = buildCatalogVersion();
  if (!options.open) {
    return { items: [current] };
  }
  return {
    items: [
      buildCatalogVersion({
        id: 'cv-2',
        number: 2,
        status: options.open,
        basedOnVersionId: 'cv-1',
        createdAt: '2026-11-12T15:00:00.000Z',
      }),
      current,
    ],
  };
}
