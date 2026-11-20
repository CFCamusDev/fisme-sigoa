import type { QualityCommittee } from '../entities/quality-committee.js';

export interface CreateQualityCommitteeInput {
  readonly id?: string;
  readonly programId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly actorId: string;
  readonly now: Date;
}

export interface ListQualityCommitteesPageInput {
  readonly programId: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface ListQualityCommitteesPageResult {
  readonly items: readonly QualityCommittee[];
  readonly total: number;
}

export interface QualityCommitteeRepository {
  lockProgram(programId: string): Promise<void>;
  findByIdForUpdate(id: string): Promise<QualityCommittee | null>;
  findById(id: string): Promise<QualityCommittee | null>;
  listByProgram(programId: string): Promise<readonly QualityCommittee[]>;
  findInForce(programId: string, today: string): Promise<QualityCommittee | null>;
  listPage(input: ListQualityCommitteesPageInput): Promise<ListQualityCommitteesPageResult>;
  create(input: CreateQualityCommitteeInput): Promise<QualityCommittee>;
  touch(id: string, actorId: string, now: Date): Promise<QualityCommittee>;
}
