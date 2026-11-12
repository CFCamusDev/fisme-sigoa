import type { Semester } from '../entities/semester.js';

export interface SemesterRepository {
  lockAndListAll(): Promise<Semester[]>;
  add(semester: Semester): Promise<void>;
}
