import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { RegisterStakeholderRequest, StakeholderDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { registerStakeholder } from '../api/register-stakeholder';
import { stakeholderKeys } from './stakeholder-keys';

/**
 * Registra un constituyente. Comparte una sola petición en vuelo para el mismo tipo y documento
 * ante doble clic o reintento inmediato.
 */
export function useRegisterStakeholder(): UseMutationResult<
  StakeholderDto,
  ApiError,
  RegisterStakeholderRequest
> {
  const queryClient = useQueryClient();

  return useMutation<StakeholderDto, ApiError, RegisterStakeholderRequest>({
    mutationFn: (input) => {
      const document = input.kind === 'PERSON' ? input.dni : input.ruc;
      return shareInFlight(`register-stakeholder:${input.kind}:${document}`, () =>
        registerStakeholder(input),
      );
    },
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
