export const SESSION_MODALITIES = ['VIRTUAL', 'IN_PERSON', 'HYBRID'] as const;

export type SessionModality = (typeof SESSION_MODALITIES)[number];

export const SESSION_URL_MAX = 500;
export const SESSION_DATE_YEAR_MIN = 2000;
export const SESSION_DATE_YEAR_MAX = 2100;
export const SESSION_MAX_EXECUTIONS = 20;
