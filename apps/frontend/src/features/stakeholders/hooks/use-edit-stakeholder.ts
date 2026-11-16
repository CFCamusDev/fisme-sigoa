import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { StakeholderDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { editStakeholder, type EditStakeholderVariables } from '../api/edit-stakeholder';
import { stakeholderKeys } from './stakeholder-keys';

/**
 * Edita un constituyente activo. Comparte una sola petición en vuelo por registro.
 */
export function useEditStakeholder(): UseMutationResult<
  StakeholderDto,
  ApiError,
  EditStakeholderVariables
> {
  const queryClient = useQueryClient();

  return useMutation<StakeholderDto, ApiError, EditStakeholderVariables>({
    mutationFn: (variables) =>
      shareInFlight(`edit-stakeholder:${variables.id}`, () => editStakeholder(variables)),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stakeholderKeys.all });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: stakeholderKeys.all });
      }
    },
  });
}
