import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { SessionAttendeesResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import {
  registerSessionAttendees,
  type RegisterSessionAttendeesVariables,
} from '../api/register-session-attendees';
import { sessionKeys } from './session-keys';

function buildRegisterAttendeesKey({ sessionId, data }: RegisterSessionAttendeesVariables): string {
  const sorted = [...data.attendees]
    .map((entry) => ({
      listMemberId: entry.listMemberId,
      position: typeof entry.position === 'string' ? entry.position.trim() || null : null,
    }))
    .sort((a, b) =>
      a.listMemberId < b.listMemberId ? -1 : a.listMemberId > b.listMemberId ? 1 : 0,
    );
  return `register-session-attendees:${sessionId}:${JSON.stringify(sorted)}`;
}

export function useRegisterSessionAttendees(): UseMutationResult<
  SessionAttendeesResponse,
  ApiError,
  RegisterSessionAttendeesVariables
> {
  const queryClient = useQueryClient();

  return useMutation<SessionAttendeesResponse, ApiError, RegisterSessionAttendeesVariables>({
    mutationFn: (variables) =>
      shareInFlight(buildRegisterAttendeesKey(variables), () =>
        registerSessionAttendees(variables),
      ),
    retry: false,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: sessionKeys.attendees(variables.sessionId),
      });
    },
    onError: (error, variables) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: sessionKeys.attendees(variables.sessionId),
        });
      }
    },
  });
}
