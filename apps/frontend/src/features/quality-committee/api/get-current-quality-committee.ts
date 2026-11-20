import {
  currentQualityCommitteeResponseSchema,
  type CurrentQualityCommitteeResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function getCurrentQualityCommittee(): Promise<CurrentQualityCommitteeResponse> {
  const response = await apiClient.get<unknown>('/quality-committees/current');
  return currentQualityCommitteeResponseSchema.parse(response.data);
}
