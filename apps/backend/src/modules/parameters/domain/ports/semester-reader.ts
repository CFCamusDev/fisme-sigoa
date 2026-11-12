import type { Semester } from '../entities/semester.js';

export interface SemesterReader {
  list(): Promise<Semester[]>;
}
