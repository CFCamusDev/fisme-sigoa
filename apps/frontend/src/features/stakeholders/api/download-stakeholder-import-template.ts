import type { StakeholderListTypeValue } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';
import { parseFileNameFromDisposition, toBlobApiError } from '@/lib/blob-download';

export interface DownloadStakeholderImportTemplateResult {
  readonly blob: Blob;
  readonly fileName: string;
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
    return toBlobApiError(error, 'No se pudo descargar la plantilla Excel.');
  }
}
