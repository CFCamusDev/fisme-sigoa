import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { PublishTemplateRequest, TemplateVersionDto } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { publishTemplate } from '../api/publish-template';
import { templateKeys } from './template-keys';

export interface PublishTemplateVariables extends PublishTemplateRequest {
  readonly templateId: string;
}

/**
 * Publica el borrador revisado. Es la única entrada de la operación: N llamadores simultáneos sobre
 * el mismo borrador comparten una sola petición. Sin reintentos: el servidor decide con 409 si el
 * borrador ya se publicó o cambió, y entonces se recargan las consultas; nunca se vuelve a publicar
 * solo, porque publicaría contenido que el administrador no revisó.
 */
export function usePublishTemplate(): UseMutationResult<
  TemplateVersionDto,
  ApiError,
  PublishTemplateVariables
> {
  const queryClient = useQueryClient();

  return useMutation<TemplateVersionDto, ApiError, PublishTemplateVariables>({
    mutationFn: ({ templateId, versionId, expectedUpdatedAt }) =>
      shareInFlight(`publish-template:${templateId}:${versionId}`, () =>
        publishTemplate(templateId, { versionId, expectedUpdatedAt }),
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
