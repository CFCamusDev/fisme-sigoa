import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CreateStakeholderListRequest, StakeholderListDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { createStakeholderList } from '../api/create-stakeholder-list';
import { stakeholderListKeys } from './stakeholder-list-keys';

export function useCreateStakeholderList(): UseMutationResult<
  StakeholderListDto,
  ApiError,
  CreateStakeholderListRequest
> {
  const queryClient = useQueryClient();

  return useMutation<StakeholderListDto, ApiError, CreateStakeholderListRequest>({
    mutationFn: (input) =>
      shareInFlight(`create-stakeholder-list:${input.type}:${input.year}`, () =>
        createStakeholderList(input),
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
