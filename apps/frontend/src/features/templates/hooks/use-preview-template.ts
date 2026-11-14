import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { PreviewTemplateRequest, PreviewTemplateResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import { previewTemplate } from '../api/preview-template';

export interface PreviewTemplateVariables extends PreviewTemplateRequest {
  readonly templateId: string;
}

/**
 * Genera la vista previa en PDF de la plantilla (HU-019, D9). Es el único punto de entrada de la
 * operación: llamadas simultáneas sobre el mismo texto comparten una sola petición y no reintenta.
 * No invalida consultas porque la vista previa no cambia estado ni persiste datos.
 */
export function usePreviewTemplate(): UseMutationResult<
  PreviewTemplateResponse,
  ApiError,
  PreviewTemplateVariables
> {
  return useMutation<PreviewTemplateResponse, ApiError, PreviewTemplateVariables>({
    mutationFn: ({ templateId, content }) =>
      shareInFlight(`preview-template:${templateId}:${content}`, () =>
        previewTemplate(templateId, { content }),
      ),
    retry: false,
  });
}
