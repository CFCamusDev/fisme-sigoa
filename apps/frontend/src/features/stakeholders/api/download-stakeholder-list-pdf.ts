import { apiClient } from '@/lib/axios';
import { parseFileNameFromDisposition, toBlobApiError } from '@/lib/blob-download';

export interface DownloadStakeholderListPdfInput {
  readonly listId: string;
  readonly fallbackFileName?: string;
}

export interface DownloadStakeholderListPdfResult {
  readonly blob: Blob;
  readonly fileName: string;
}

/** Descarga el PDF oficial del Anexo 3 (FO-03) consolidado para la lista solicitada (HU-026). */
export async function downloadStakeholderListPdf(
  input: DownloadStakeholderListPdfInput,
): Promise<DownloadStakeholderListPdfResult> {
  const fallbackFileName = input.fallbackFileName ?? 'fo-03.pdf';
  try {
    const response = await apiClient.get<Blob>(
      `/stakeholder-lists/${encodeURIComponent(input.listId)}/pdf`,
      {
        responseType: 'blob',
      },
    );

    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    return {
      blob: response.data,
      fileName: parseFileNameFromDisposition(contentDisposition, fallbackFileName),
    };
  } catch (error) {
    return toBlobApiError(error, 'No se pudo descargar el PDF del Anexo 3.');
  }
}
