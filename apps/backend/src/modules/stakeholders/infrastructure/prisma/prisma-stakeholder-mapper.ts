import type {
  StakeholderKind,
  StakeholderStatus,
} from '../../domain/entities/stakeholder-enums.js';
import { Stakeholder } from '../../domain/entities/stakeholder.js';

export interface PrismaStakeholderRow {
  id: string;
  kind: StakeholderKind;
  fullName: string;
  dni: string | null;
  ruc: string | null;
  email: string | null;
  mobile: string | null;
  position: string | null;
  institution: string | null;
  sector: string | null;
  graduationYear: number | null;
  cycle: string | null;
  status: StakeholderStatus;
  voidReason: string | null;
  voidedAt: Date | null;
  voidedBy: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function mapPrismaStakeholderRowToDomain(row: PrismaStakeholderRow): Stakeholder {
  return Stakeholder.create({
    id: row.id,
    kind: row.kind,
    fullName: row.fullName,
    dni: row.dni,
    ruc: row.ruc,
    email: row.email,
    mobile: row.mobile,
    position: row.position,
    institution: row.institution,
    sector: row.sector,
    graduationYear: row.graduationYear,
    cycle: row.cycle,
    status: row.status,
    voidReason: row.voidReason,
    voidedAt: row.voidedAt,
    voidedBy: row.voidedBy,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
