import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { SessionDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { updateSession, type UpdateSessionVariables } from '../api/update-session';
import { sessionKeys } from './session-keys';

function buildUpdateSessionKey({ id, data }: UpdateSessionVariables): string {
  const normalized = {
    id,
    stakeholderType: data.stakeholderType,
    stakeholderListId: data.stakeholderListId,
    sessionDate: data.sessionDate?.trim(),
    startTime: data.startTime?.trim(),
    modality: data.modality,
    meetingUrl:
      typeof data.meetingUrl === 'string' ? data.meetingUrl.trim() || null : data.meetingUrl,
    recordingUrl:
      typeof data.recordingUrl === 'string' ? data.recordingUrl.trim() || null : data.recordingUrl,
    executionIds: data.executionIds ? [...data.executionIds].sort() : undefined,
  };
  return `update-session:${JSON.stringify(normalized)}`;
}

export function useUpdateSession(): UseMutationResult<
  SessionDto,
  ApiError,
  UpdateSessionVariables
> {
  const queryClient = useQueryClient();

  return useMutation<SessionDto, ApiError, UpdateSessionVariables>({
    mutationFn: (variables) =>
      shareInFlight(buildUpdateSessionKey(variables), () => updateSession(variables)),
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
