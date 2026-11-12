import { ResponseScale, type ScaleType } from '../../domain/entities/response-scale.js';

export interface PrismaScaleLevelRow {
  order: number;
  label: string;
  value: number;
  countsAsAchievement: boolean;
}

export interface PrismaResponseScaleRow {
  id: string;
  code: string;
  name: string;
  type: ScaleType;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  levels: PrismaScaleLevelRow[];
}

export function mapPrismaResponseScaleRowToDomain(row: PrismaResponseScaleRow): ResponseScale {
  return ResponseScale.create({
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    levels: [...row.levels]
      .sort((a, b) => a.order - b.order)
      .map((level) => ({
        order: level.order,
        label: level.label,
        value: level.value,
        countsAsAchievement: level.countsAsAchievement,
      })),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
