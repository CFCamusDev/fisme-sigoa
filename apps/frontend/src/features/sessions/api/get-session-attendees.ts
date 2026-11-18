import { sessionAttendeesResponseSchema, type SessionAttendeesResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function getSessionAttendees(sessionId: string): Promise<SessionAttendeesResponse> {
  const response = await apiClient.get<unknown>(`/sessions/${sessionId}/attendees`);
  return sessionAttendeesResponseSchema.parse(response.data);
}
