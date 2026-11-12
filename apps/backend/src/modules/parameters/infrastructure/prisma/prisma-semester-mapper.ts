import { Semester } from '../../domain/entities/semester.js';

export interface PrismaSemesterRow {
  id: string;
  code: string;
  startDate: Date;
  endDate: Date;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function formatDateToIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDayToDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

export function mapPrismaSemesterRowToDomain(row: PrismaSemesterRow): Semester {
  return Semester.create({
    id: row.id,
    code: row.code,
    startDate: formatDateToIsoDay(row.startDate),
    endDate: formatDateToIsoDay(row.endDate),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
