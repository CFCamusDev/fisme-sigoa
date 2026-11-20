export const COMMITTEE_MEMBER_POSITIONS = ['PRESIDENT', 'MEMBER'] as const;

export type CommitteeMemberPosition = (typeof COMMITTEE_MEMBER_POSITIONS)[number];
