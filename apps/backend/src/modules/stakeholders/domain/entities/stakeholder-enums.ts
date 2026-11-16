export const STAKEHOLDER_KINDS = ['PERSON', 'INSTITUTION'] as const;
export type StakeholderKind = (typeof STAKEHOLDER_KINDS)[number];

export const STAKEHOLDER_STATUSES = ['ACTIVE', 'VOIDED'] as const;
export type StakeholderStatus = (typeof STAKEHOLDER_STATUSES)[number];

export const STAKEHOLDER_FULL_NAME_MAX_LENGTH = 200;
export const STAKEHOLDER_DNI_PATTERN = /^\d{8}$/;
export const STAKEHOLDER_RUC_PATTERN = /^\d{11}$/;
export const STAKEHOLDER_MOBILE_PATTERN = /^9\d{8}$/;
export const STAKEHOLDER_EMAIL_MAX_LENGTH = 254;
export const STAKEHOLDER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const STAKEHOLDER_POSITION_MAX_LENGTH = 150;
export const STAKEHOLDER_INSTITUTION_MAX_LENGTH = 200;
export const STAKEHOLDER_SECTOR_MAX_LENGTH = 150;
export const STAKEHOLDER_CYCLE_MAX_LENGTH = 50;
export const STAKEHOLDER_GRADUATION_YEAR_MIN = 1950;
export const STAKEHOLDER_GRADUATION_YEAR_MAX = 2100;
export const STAKEHOLDER_VOID_REASON_MIN_LENGTH = 10;
export const STAKEHOLDER_VOID_REASON_MAX_LENGTH = 500;
