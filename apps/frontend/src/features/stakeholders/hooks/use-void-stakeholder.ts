import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { StakeholderDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { voidStakeholder, type VoidStakeholderVariables } from '../api/void-stakeholder';
import { stakeholderKeys } from './stakeholder-keys';

/**
 * Anula un constituyente activo con motivo obligatorio. Comparte una sola petición en vuelo por registro.
 */
export function useVoidStakeholder(): UseMutationResult<
  StakeholderDto,
  ApiError,
  VoidStakeholderVariables
> {
  const queryClient = useQueryClient();

  return useMutation<StakeholderDto, ApiError, VoidStakeholderVariables>({
    mutationFn: (variables) =>
      shareInFlight(`void-stakeholder:${variables.id}`, () => voidStakeholder(variables)),
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
