import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ResolutionDto } from '@sigoa/shared';
import { catalogKeys } from '@/features/catalog';
import type { ApiError } from '@/lib/api-error';
import { approveResolution } from '../api/approve-resolution';
import { shareInFlight } from '../lib/shared-in-flight';
import { resolutionKeys } from './resolution-keys';

export interface ApproveResolutionVariables {
  readonly resolutionId: string;
  readonly file: Blob;
}

/**
 * Aprueba la resolución con el PDF firmado. Es la única entrada de la operación: N llamadores
 * simultáneos sobre la misma resolución comparten una sola petición (doble clic, Enter repetido).
 * Sin reintentos: el servidor decide con 409 si otra persona ya la aprobó; en 404/409 se recarga
 * el listado para mostrar el estado real.
 */
export function useApproveResolution(): UseMutationResult<
  ResolutionDto,
  ApiError,
  ApproveResolutionVariables
> {
  const queryClient = useQueryClient();

  return useMutation<ResolutionDto, ApiError, ApproveResolutionVariables>({
    mutationFn: ({ resolutionId, file }) =>
      shareInFlight(`approve-resolution:${resolutionId}`, () =>
        approveResolution(resolutionId, file),
      ),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resolutionKeys.all });
      // Aprobar la resolución activa la versión del catálogo (HU-016): evita mostrar la anterior como vigente.
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: resolutionKeys.all });
      }
    },
  });
}
