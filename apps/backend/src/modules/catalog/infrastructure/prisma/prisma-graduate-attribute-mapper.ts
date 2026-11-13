import { GraduateAttribute } from '../../domain/entities/graduate-attribute.js';

export interface PrismaGraduateAttributeRow {
  id: string;
  versionId: string;
  code: string;
  name: string;
  statement: string;
  order: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function mapPrismaGraduateAttributeRowToDomain(
  row: PrismaGraduateAttributeRow,
): GraduateAttribute {
  return GraduateAttribute.create({
    id: row.id,
    versionId: row.versionId,
    code: row.code,
    name: row.name,
    statement: row.statement,
    order: row.order,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
