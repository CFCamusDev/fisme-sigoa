import { ANNEX_VERSION_HEADER, type AnnexCode } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';
import { parseFileNameFromDisposition, toBlobApiError } from '@/lib/blob-download';

export interface DownloadAnnexPdfResult {
  readonly blob: Blob;
  readonly fileName: string;
  readonly versionNumber: number | null;
}

function parseVersionHeader(header: unknown): number | null {
  if (typeof header !== 'string') {
    return null;
  }
  const parsed = Number.parseInt(header.trim(), 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

/** Descarga el PDF oficial de uno de los 11 anexos (HU-070, RF-070). */
export async function downloadAnnexPdf(code: AnnexCode): Promise<DownloadAnnexPdfResult> {
  const fallbackFileName = `${code.toLowerCase()}.pdf`;
  try {
    const response = await apiClient.get<Blob>(`/annexes/${code}/pdf`, {
      responseType: 'blob',
    });

    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    const rawVersion = response.headers[ANNEX_VERSION_HEADER] as string | undefined;

    return {
      blob: response.data,
      fileName: parseFileNameFromDisposition(contentDisposition, fallbackFileName),
      versionNumber: parseVersionHeader(rawVersion),
    };
  } catch (error) {
    return toBlobApiError(error, 'No se pudo descargar el anexo en PDF.');
  }
}
