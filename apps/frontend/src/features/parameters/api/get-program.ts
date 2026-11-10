import { programDtoSchema, type ProgramDto } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function getProgram(): Promise<ProgramDto> {
  const response = await apiClient.get<unknown>('/program');
  return programDtoSchema.parse(response.data);
}
