import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CreateSessionRequest, SessionDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { createSession } from '../api/create-session';
import { sessionKeys } from './session-keys';

function buildCreateSessionKey(input: CreateSessionRequest): string {
  const normalized = {
    stakeholderType: input.stakeholderType,
    stakeholderListId: input.stakeholderListId ?? null,
    sessionDate: input.sessionDate.trim(),
    startTime: input.startTime.trim(),
    modality: input.modality,
    meetingUrl: input.meetingUrl?.trim() || null,
    recordingUrl: input.recordingUrl?.trim() || null,
    executionIds: [...input.executionIds].sort(),
  };
  return `create-session:${JSON.stringify(normalized)}`;
}

export function useCreateSession(): UseMutationResult<SessionDto, ApiError, CreateSessionRequest> {
  const queryClient = useQueryClient();

  return useMutation<SessionDto, ApiError, CreateSessionRequest>({
    mutationFn: (input) => shareInFlight(buildCreateSessionKey(input), () => createSession(input)),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      }
    },
  });
}
