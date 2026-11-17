import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ConfirmStakeholderImportResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { confirmStakeholderImport } from '../api/confirm-stakeholder-import';
import type { StakeholderImportFileInput } from '../api/preview-stakeholder-import';
import { stakeholderKeys } from './stakeholder-keys';
import { stakeholderListKeys } from './stakeholder-list-keys';

export function useConfirmStakeholderImport(): UseMutationResult<
  ConfirmStakeholderImportResponse,
  ApiError,
  StakeholderImportFileInput
> {
  const queryClient = useQueryClient();

  return useMutation<ConfirmStakeholderImportResponse, ApiError, StakeholderImportFileInput>({
    mutationFn: (input) =>
      shareInFlight(
        `confirm-stakeholder-import:${input.listId}:${input.file.name}:${input.file.size}:${input.file.lastModified}`,
        () => confirmStakeholderImport(input),
      ),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stakeholderListKeys.all });
      void queryClient.invalidateQueries({ queryKey: stakeholderKeys.all });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: stakeholderListKeys.all });
      }
    },
  });
}
