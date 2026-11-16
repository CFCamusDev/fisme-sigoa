import type { StakeholderListType } from '../../domain/entities/stakeholder-list-enums.js';
import { StakeholderList } from '../../domain/entities/stakeholder-list.js';

export interface PrismaStakeholderListRow {
  id: string;
  programId: string;
  type: StakeholderListType;
  year: number;
  studyPlanNumber: string | null;
  version: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function mapPrismaStakeholderListRowToDomain(
  row: PrismaStakeholderListRow,
): StakeholderList {
  return StakeholderList.reconstitute({
    id: row.id,
    programId: row.programId,
    type: row.type,
    year: row.year,
    studyPlanNumber: row.studyPlanNumber,
    version: row.version,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
