import { apiErrorResponseSchema, type StakeholderListTypeValue } from '@sigoa/shared';
import { isAxiosError } from 'axios';
import { ApiError } from '@/lib/api-error';
import { apiClient } from '@/lib/axios';

export interface DownloadStakeholderImportTemplateResult {
  readonly blob: Blob;
  readonly fileName: string;
}

function parseFileNameFromDisposition(header: string | undefined, fallback: string): string {
  if (!header) {
    return fallback;
  }
  const match = /filename="?([^";]+)"?/i.exec(header);
  const extracted = match?.[1]?.trim();
  return extracted && extracted.length > 0 ? extracted : fallback;
}

async function toBlobApiError(error: unknown): Promise<never> {
  if (error instanceof ApiError) {
    throw error;
  }

  if (isAxiosError(error) && error.response) {
    const { status, data } = error.response;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const parsed = apiErrorResponseSchema.safeParse(JSON.parse(text));
        if (parsed.success) {
          throw new ApiError({
            code: parsed.data.error.code,
            message: parsed.data.error.message,
            status,
            details: parsed.data.error.details,
            requestId: parsed.data.error.requestId,
          });
        }
      } catch (innerError) {
        if (innerError instanceof ApiError) {
          throw innerError;
        }
      }
    }

    throw new ApiError({
      code: 'HTTP_ERROR',
      message: 'No se pudo descargar la plantilla Excel.',
      status,
    });
  }

  throw error;
}

/** Descarga la plantilla Excel para importar constituyentes según el tipo de lista. */
export async function downloadStakeholderImportTemplate(
  type: StakeholderListTypeValue,
): Promise<DownloadStakeholderImportTemplateResult> {
  const fallbackFileName = `plantilla-${type.toLowerCase()}.xlsx`;
  try {
    const response = await apiClient.get<Blob>('/stakeholder-lists/excel-template', {
      params: { type },
      responseType: 'blob',
    });

    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    return {
      blob: response.data,
      fileName: parseFileNameFromDisposition(contentDisposition, fallbackFileName),
    };
  } catch (error) {
    return toBlobApiError(error);
  }
}
