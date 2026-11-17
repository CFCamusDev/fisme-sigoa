import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CopyStakeholderListResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { copyStakeholderList, type CopyStakeholderListInput } from '../api/copy-stakeholder-list';
import { stakeholderListKeys } from './stakeholder-list-keys';

export function useCopyStakeholderList(): UseMutationResult<
  CopyStakeholderListResponse,
  ApiError,
  CopyStakeholderListInput
> {
  const queryClient = useQueryClient();

  return useMutation<CopyStakeholderListResponse, ApiError, CopyStakeholderListInput>({
    mutationFn: (input) =>
      shareInFlight(`copy-stakeholder-list:${input.sourceListId}:${input.year}`, () =>
        copyStakeholderList(input),
      ),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stakeholderListKeys.all });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: stakeholderListKeys.all });
      }
    },
  });
}
