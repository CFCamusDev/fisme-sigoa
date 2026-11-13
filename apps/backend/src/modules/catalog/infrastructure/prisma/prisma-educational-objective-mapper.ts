import { EducationalObjective } from '../../domain/entities/educational-objective.js';

export interface PrismaEducationalObjectiveRow {
  id: string;
  versionId: string;
  code: string;
  statement: string;
  order: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function mapPrismaEducationalObjectiveRowToDomain(
  row: PrismaEducationalObjectiveRow,
): EducationalObjective {
  return EducationalObjective.create({
    id: row.id,
    versionId: row.versionId,
    code: row.code,
    statement: row.statement,
    order: row.order,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
