import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { StakeholderListMemberDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import {
  addStakeholderListMember,
  type AddStakeholderListMemberInput,
} from '../api/add-stakeholder-list-member';
import { stakeholderListKeys } from './stakeholder-list-keys';

export function useAddStakeholderListMember(): UseMutationResult<
  StakeholderListMemberDto,
  ApiError,
  AddStakeholderListMemberInput
> {
  const queryClient = useQueryClient();

  return useMutation<StakeholderListMemberDto, ApiError, AddStakeholderListMemberInput>({
    mutationFn: (input) =>
      shareInFlight(`add-stakeholder-list-member:${input.listId}:${input.stakeholderId}`, () =>
        addStakeholderListMember(input),
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
