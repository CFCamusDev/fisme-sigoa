import {
  programDtoSchema,
  updateProgramRequestSchema,
  type ProgramDto,
  type UpdateProgramRequest,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function updateProgram(body: UpdateProgramRequest): Promise<ProgramDto> {
  const validatedBody = updateProgramRequestSchema.parse(body);
  const response = await apiClient.patch<unknown>('/program', validatedBody);
  return programDtoSchema.parse(response.data);
}
