import { programDtoSchema, type ProgramDto } from '@sigoa/shared';
import type { Program } from '../domain/entities/program.js';

export function mapProgramToDto(program: Program): ProgramDto {
  const raw = {
    id: program.id,
    code: program.code,
    name: program.name,
    faculty: program.faculty,
    updatedAt: program.updatedAt.toISOString(),
  };

  return programDtoSchema.parse(raw);
}
