import type { ResolutionStatus, ResolutionType } from '../../domain/entities/resolution-enums.js';
import { Resolution } from '../../domain/entities/resolution.js';

export interface PrismaResolutionRow {
  id: string;
  type: ResolutionType;
  number: string;
  issuedOn: Date;
  status: ResolutionStatus;
  catalogVersionId: string | null;
  pdfFileId: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function mapPrismaResolutionRowToDomain(row: PrismaResolutionRow): Resolution {
  return Resolution.create({
    id: row.id,
    type: row.type,
    number: row.number,
    issuedOn: row.issuedOn,
    status: row.status,
    catalogVersionId: row.catalogVersionId,
    pdfFileId: row.pdfFileId,
    approvedAt: row.approvedAt,
    approvedBy: row.approvedBy,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
