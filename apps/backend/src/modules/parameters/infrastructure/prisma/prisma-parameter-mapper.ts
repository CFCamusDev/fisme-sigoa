import { Parameter } from '../../domain/entities/parameter.js';
import type { ParameterVersion } from '../../domain/ports/parameter-reader.js';
import { formatDateToIsoDay } from './prisma-semester-mapper.js';

export interface PrismaParameterRow {
  id: string;
  key: string;
  value: number;
  effectiveFromSemesterId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  effectiveFromSemester: { code: string; startDate: Date } | null;
}

export function mapPrismaParameterRowToVersion(row: PrismaParameterRow): ParameterVersion {
  return {
    parameter: Parameter.create({
      id: row.id,
      key: row.key,
      value: row.value,
      effectiveFromSemesterId: row.effectiveFromSemesterId,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }),
    semesterCode: row.effectiveFromSemester?.code ?? null,
    semesterStartDate: row.effectiveFromSemester
      ? formatDateToIsoDay(row.effectiveFromSemester.startDate)
      : null,
  };
}

/** Orden estable: por clave y vigencia ascendente (el valor por defecto primero). */
export function compareParameterVersions(a: ParameterVersion, b: ParameterVersion): number {
  if (a.parameter.key !== b.parameter.key) {
    return a.parameter.key < b.parameter.key ? -1 : 1;
  }
  if (a.semesterStartDate === b.semesterStartDate) {
    return 0;
  }
  if (a.semesterStartDate === null) {
    return -1;
  }
  if (b.semesterStartDate === null) {
    return 1;
  }
  return a.semesterStartDate < b.semesterStartDate ? -1 : 1;
}
