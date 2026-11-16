import { StakeholderListMember } from '../../domain/entities/stakeholder-list-member.js';

export interface PrismaStakeholderListMemberRow {
  id: string;
  listId: string;
  stakeholderId: string;
  fullName: string;
  institution: string | null;
  ruc: string | null;
  sector: string | null;
  representative: string | null;
  activity: string | null;
  email: string | null;
  mobile: string | null;
  position: string | null;
  graduationYear: number | null;
  cycle: string | null;
  createdBy: string;
  createdAt: Date;
}

export function mapPrismaStakeholderListMemberRowToDomain(
  row: PrismaStakeholderListMemberRow,
): StakeholderListMember {
  return StakeholderListMember.reconstitute({
    id: row.id,
    listId: row.listId,
    stakeholderId: row.stakeholderId,
    fullName: row.fullName,
    institution: row.institution,
    ruc: row.ruc,
    sector: row.sector,
    representative: row.representative,
    activity: row.activity,
    email: row.email,
    mobile: row.mobile,
    position: row.position,
    graduationYear: row.graduationYear,
    cycle: row.cycle,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  });
}
