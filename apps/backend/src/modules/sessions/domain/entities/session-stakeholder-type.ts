export const SESSION_STAKEHOLDER_TYPES = [
  'ADVISORY_BOARD',
  'EMPLOYER',
  'GRADUATE',
  'TEACHER',
  'STUDENT',
] as const;

export type SessionStakeholderType = (typeof SESSION_STAKEHOLDER_TYPES)[number];
