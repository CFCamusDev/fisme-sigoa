import {
  resolutionDtoSchema,
  type RegisterResolutionRequest,
  type ResolutionDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Registra la resolución del Decano vinculada a una versión En validación (HU-048, CA1). */
export async function registerResolution(input: RegisterResolutionRequest): Promise<ResolutionDto> {
  const response = await apiClient.post<unknown>('/resolutions', input);
  return resolutionDtoSchema.parse(response.data);
}
