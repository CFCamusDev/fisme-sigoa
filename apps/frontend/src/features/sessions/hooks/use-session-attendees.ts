import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { SessionAttendeesResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getSessionAttendees } from '../api/get-session-attendees';
import { sessionKeys } from './session-keys';

export function useSessionAttendees(
  sessionId: string | undefined,
): UseQueryResult<SessionAttendeesResponse, ApiError> {
  return useQuery<SessionAttendeesResponse, ApiError>({
    queryKey: sessionKeys.attendees(sessionId ?? ''),
    queryFn: () => getSessionAttendees(sessionId!),
    enabled: Boolean(sessionId),
    staleTime: 30_000,
    retry: false,
  });
}
