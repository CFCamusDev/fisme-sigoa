import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { SaveTemplateDraftRequest, TemplateVersionDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { saveTemplateDraft } from '../api/save-template-draft';
import { templateKeys } from './template-keys';

export interface SaveTemplateDraftVariables {
  readonly templateId: string;
  readonly content: string;
}

/**
 * Guarda el borrador. Es la única entrada de la operación: N llamadores simultáneos sobre la misma
 * plantilla comparten una sola petición (doble clic, Enter repetido). Sin reintentos automáticos:
 * en 404/409 se recargan las consultas para mostrar el estado real.
 */
export function useSaveTemplateDraft(): UseMutationResult<
  TemplateVersionDto,
  ApiError,
  SaveTemplateDraftVariables
> {
  const queryClient = useQueryClient();

  return useMutation<TemplateVersionDto, ApiError, SaveTemplateDraftVariables>({
    mutationFn: ({ templateId, content }) =>
      shareInFlight(`save-template-draft:${templateId}`, () =>
        saveTemplateDraft(templateId, { content } satisfies SaveTemplateDraftRequest),
      ),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
    onError: (error) => {
      if (error.status === 404 || error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: templateKeys.all });
      }
    },
  });
}
