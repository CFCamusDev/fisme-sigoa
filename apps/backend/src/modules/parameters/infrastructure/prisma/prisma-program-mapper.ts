import { Program } from '../../domain/entities/program.js';

export interface PrismaProgramRow {
  id: string;
  code: string;
  name: string;
  faculty: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function mapPrismaProgramRowToDomain(row: PrismaProgramRow): Program {
  return Program.create({
    id: row.id,
    code: row.code,
    name: row.name,
    faculty: row.faculty,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
