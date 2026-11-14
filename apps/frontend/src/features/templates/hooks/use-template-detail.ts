import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { TemplateDetailDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { getTemplate } from '../api/get-template';
import { templateKeys } from './template-keys';

/** Detalle de la plantilla abierta; sin `templateId` no consulta. */
export function useTemplateDetail(
  templateId: string | undefined,
): UseQueryResult<TemplateDetailDto, ApiError> {
  return useQuery<TemplateDetailDto, ApiError>({
    queryKey: templateKeys.detail(templateId ?? ''),
    queryFn: () => getTemplate(templateId ?? ''),
    enabled: templateId !== undefined,
    staleTime: 0,
    retry: false,
  });
}
