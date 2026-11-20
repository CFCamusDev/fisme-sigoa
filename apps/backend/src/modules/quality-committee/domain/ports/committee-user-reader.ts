export type CommitteeUserStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'INACTIVE';

export interface CommitteeUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly status: CommitteeUserStatus;
}

export interface CommitteeUserReader {
  findByIds(ids: readonly string[]): Promise<readonly CommitteeUserRef[]>;
  findByEmails(emails: readonly string[]): Promise<ReadonlyMap<string, CommitteeUserRef>>;
}
