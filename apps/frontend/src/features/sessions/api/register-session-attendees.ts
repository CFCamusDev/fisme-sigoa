import {
  sessionAttendeesResponseSchema,
  type RegisterSessionAttendeesRequest,
  type SessionAttendeesResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface RegisterSessionAttendeesVariables {
  readonly sessionId: string;
  readonly data: RegisterSessionAttendeesRequest;
}

export async function registerSessionAttendees({
  sessionId,
  data,
}: RegisterSessionAttendeesVariables): Promise<SessionAttendeesResponse> {
  const response = await apiClient.put<unknown>(`/sessions/${sessionId}/attendees`, data);
  return sessionAttendeesResponseSchema.parse(response.data);
}
