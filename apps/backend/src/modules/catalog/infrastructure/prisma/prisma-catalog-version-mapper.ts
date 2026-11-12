import {
  CatalogVersion,
  type CatalogVersionStatus,
} from '../../domain/entities/catalog-version.js';

export interface PrismaCatalogVersionRow {
  id: string;
  programId: string;
  number: number;
  status: CatalogVersionStatus;
  basedOnVersionId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function mapPrismaCatalogVersionRowToDomain(row: PrismaCatalogVersionRow): CatalogVersion {
  return CatalogVersion.create({
    id: row.id,
    programId: row.programId,
    number: row.number,
    status: row.status,
    basedOnVersionId: row.basedOnVersionId,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
