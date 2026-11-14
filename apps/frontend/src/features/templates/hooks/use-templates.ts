import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ListTemplatesResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getTemplates, type GetTemplatesParams } from '../api/get-templates';
import { templateKeys } from './template-keys';

export function useTemplates(
  params: GetTemplatesParams = {},
): UseQueryResult<ListTemplatesResponse, ApiError> {
  return useQuery<ListTemplatesResponse, ApiError>({
    queryKey: templateKeys.list(params),
    queryFn: () => getTemplates(params),
    staleTime: 30_000,
    retry: false,
  });
}
