import type { Program } from '../entities/program.js';

export interface ProgramReader {
  getCurrent(): Promise<Program | null>;
}
