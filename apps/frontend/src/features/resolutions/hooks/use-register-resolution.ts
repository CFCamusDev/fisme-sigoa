import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { RegisterResolutionRequest, ResolutionDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { registerResolution } from '../api/register-resolution';
import { shareInFlight } from '@/lib/shared-in-flight';
import { resolutionKeys } from './resolution-keys';

/**
 * Registra una resolución. Es la única entrada de la operación: N llamadores simultáneos con el
 * mismo tipo y número comparten una sola petición (doble clic, Enter repetido). Sin reintentos: el
 * servidor decide con 409 si el número o la versión ya tienen una resolución de ese tipo.
 */
export function useRegisterResolution(): UseMutationResult<
  ResolutionDto,
  ApiError,
  RegisterResolutionRequest
> {
  const queryClient = useQueryClient();

  return useMutation<ResolutionDto, ApiError, RegisterResolutionRequest>({
    mutationFn: (input) =>
      shareInFlight(`register-resolution:${input.type}:${input.number}`, () =>
        registerResolution(input),
      ),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resolutionKeys.all });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: resolutionKeys.all });
      }
    },
  });
}
