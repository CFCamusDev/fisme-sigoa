import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { QualityCommitteeDto, RegisterQualityCommitteeRequest } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { registerQualityCommittee } from '../api/register-quality-committee';
import { qualityCommitteeKeys } from './quality-committee-keys';

function buildRegisterCommitteeKey(input: RegisterQualityCommitteeRequest): string {
  const members = input.members
    .map((member) => ({
      fullName: member.fullName.trim(),
      degree: member.degree.trim(),
      position: member.position,
      userId: member.userId?.trim() || null,
      userEmail: member.userEmail?.trim().toLowerCase() || null,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return `register-quality-committee:${input.periodStart.trim()}:${input.periodEnd.trim()}:${JSON.stringify(members)}`;
}

export function useRegisterQualityCommittee(): UseMutationResult<
  QualityCommitteeDto,
  ApiError,
  RegisterQualityCommitteeRequest
> {
  const queryClient = useQueryClient();

  return useMutation<QualityCommitteeDto, ApiError, RegisterQualityCommitteeRequest>({
    mutationFn: (input) =>
      shareInFlight(buildRegisterCommitteeKey(input), () => registerQualityCommittee(input)),
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
