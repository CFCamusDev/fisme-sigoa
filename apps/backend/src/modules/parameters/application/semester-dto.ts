import type { SemesterDto } from '@sigoa/shared';
import type { Semester } from '../domain/entities/semester.js';

export function mapSemesterToDto(semester: Semester): SemesterDto {
  return {
    id: semester.id,
    code: semester.code,
    startDate: semester.startDate,
    endDate: semester.endDate,
    updatedAt: semester.updatedAt.toISOString(),
  };
}
