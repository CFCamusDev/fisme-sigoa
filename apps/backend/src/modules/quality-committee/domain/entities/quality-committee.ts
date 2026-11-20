export interface QualityCommittee {
  readonly id: string;
  readonly programId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly createdBy: string;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
