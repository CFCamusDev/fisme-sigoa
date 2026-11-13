import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CatalogVersionDetailDto, CatalogVersionDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { sendCatalogVersionToValidation } from '../api/send-catalog-version-to-validation';
import { shareInFlight } from '../lib/shared-in-flight';
import { catalogKeys } from './catalog-keys';

/**
 * Envía la versión a validación. Es la única entrada de la operación: N llamadores simultáneos
 * comparten una sola petición (doble clic, Enter repetido). Sin reintentos: el servidor decide con
 * 409 si otra persona ya cambió el estado. En 404/409 recarga el detalle para mostrar el real.
 */
export function useSendCatalogVersionToValidation(
  versionId: string,
): UseMutationResult<CatalogVersionDto, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation<CatalogVersionDto, ApiError, void>({
    mutationFn: () =>
      shareInFlight(`send-validation:${versionId}`, () =>
        sendCatalogVersionToValidation(versionId),
      ),
    retry: false,
    onSuccess: (version) => {
      queryClient.setQueryData<CatalogVersionDetailDto>(catalogKeys.detail(versionId), (detail) =>
        detail ? { ...detail, version } : detail,
      );
      void queryClient.invalidateQueries({ queryKey: catalogKeys.list() });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: catalogKeys.detail(versionId) });
        void queryClient.invalidateQueries({ queryKey: catalogKeys.list() });
      }
    },
  });
}
