import type { Program } from '../entities/program.js';

export interface ProgramRepository {
  findCurrentForUpdate(): Promise<Program | null>;
  save(program: Program): Promise<void>;
  add?(program: Program): Promise<void>;
}
