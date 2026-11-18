import { sessionDtoSchema, type CreateSessionRequest, type SessionDto } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function createSession(input: CreateSessionRequest): Promise<SessionDto> {
  const response = await apiClient.post<unknown>('/sessions', input);
  return sessionDtoSchema.parse(response.data);
}
