import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { CatalogVersionDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { createCatalogVersion } from '../api/create-catalog-version';
import { catalogKeys } from './catalog-keys';

/**
 * Crea una versión del catálogo. Sin reintentos: es una acción de usuario y el servidor decide
 * con 409 si ya hay una abierta. La lista se refresca también cuando falla por conflicto.
 */
export function useCreateCatalogVersion(): UseMutationResult<CatalogVersionDto, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation<CatalogVersionDto, ApiError, void>({
    mutationFn: () => createCatalogVersion(),
    retry: false,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
  });
}
