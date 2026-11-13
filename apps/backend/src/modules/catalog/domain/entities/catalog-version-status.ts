export const CATALOG_VERSION_STATUSES = [
  'DRAFT',
  'IN_VALIDATION',
  'APPROVED',
  'HISTORICAL',
] as const;
export type CatalogVersionStatus = (typeof CATALOG_VERSION_STATUSES)[number];
