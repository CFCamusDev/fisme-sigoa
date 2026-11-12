import { healthResponseSchema, type HealthResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function getHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<unknown>('/health');
  return healthResponseSchema.parse(response.data);
}
