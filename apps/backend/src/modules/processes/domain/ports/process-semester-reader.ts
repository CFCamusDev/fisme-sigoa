export interface ProcessSemesterRecord {
  readonly id: string;
  readonly code: string;
}

export interface ProcessSemesterReader {
  findById(id: string): Promise<ProcessSemesterRecord | null>;
}
