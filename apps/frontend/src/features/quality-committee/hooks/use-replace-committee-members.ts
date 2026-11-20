import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { QualityCommitteeDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import {
  replaceCommitteeMembers,
  type ReplaceCommitteeMembersVariables,
} from '../api/replace-committee-members';
import { qualityCommitteeKeys } from './quality-committee-keys';

function buildReplaceMembersKey({ committeeId, body }: ReplaceCommitteeMembersVariables): string {
  const members = body.members
    .map((member) => ({
      fullName: member.fullName.trim(),
      degree: member.degree.trim(),
      position: member.position,
      userId: member.userId?.trim() || null,
      userEmail: member.userEmail?.trim().toLowerCase() || null,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return `replace-committee-members:${committeeId}:${JSON.stringify(members)}`;
}

export function useReplaceCommitteeMembers(): UseMutationResult<
  QualityCommitteeDto,
  ApiError,
  ReplaceCommitteeMembersVariables
> {
  const queryClient = useQueryClient();

  return useMutation<QualityCommitteeDto, ApiError, ReplaceCommitteeMembersVariables>({
    mutationFn: (variables) =>
      shareInFlight(buildReplaceMembersKey(variables), () => replaceCommitteeMembers(variables)),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qualityCommitteeKeys.all });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: qualityCommitteeKeys.all });
      }
    },
  });
}
