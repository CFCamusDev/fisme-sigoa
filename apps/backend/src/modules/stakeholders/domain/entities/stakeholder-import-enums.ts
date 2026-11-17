export const STAKEHOLDER_IMPORT_ROW_STATUSES = [
  'NEW',
  'EXISTING',
  'ALREADY_IN_LIST',
  'INVALID',
] as const;

export type StakeholderImportRowStatus = (typeof STAKEHOLDER_IMPORT_ROW_STATUSES)[number];
