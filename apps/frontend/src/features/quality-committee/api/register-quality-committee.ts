import {
  qualityCommitteeSchema,
  type QualityCommitteeDto,
  type RegisterQualityCommitteeRequest,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function registerQualityCommittee(
  input: RegisterQualityCommitteeRequest,
): Promise<QualityCommitteeDto> {
  const response = await apiClient.post<unknown>('/quality-committees', input);
  return qualityCommitteeSchema.parse(response.data);
}
