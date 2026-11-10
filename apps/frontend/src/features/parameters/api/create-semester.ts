import {
  createSemesterRequestSchema,
  semesterDtoSchema,
  type CreateSemesterRequest,
  type SemesterDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function createSemester(body: CreateSemesterRequest): Promise<SemesterDto> {
  const validatedBody = createSemesterRequestSchema.parse(body);
  const response = await apiClient.post<unknown>('/semesters', validatedBody);
  return semesterDtoSchema.parse(response.data);
}
