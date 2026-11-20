import { useMutation } from '@tanstack/react-query';
import type { AnnexCode } from '@sigoa/shared';
import { shareInFlight } from '@/lib/shared-in-flight';
import { downloadAnnexPdf, type DownloadAnnexPdfResult } from '../api/download-annex-pdf';

/**
 * Punto de entrada único para descargar un anexo oficial en PDF (HU-070, D8).
 * Evita descargas duplicadas en vuelo para el mismo código y no reintenta automáticamente.
 */
export function useDownloadAnnexPdf() {
  return useMutation<DownloadAnnexPdfResult, Error, AnnexCode>({
    mutationFn: (code) => shareInFlight(`annex-pdf:${code}`, () => downloadAnnexPdf(code)),
    retry: false,
  });
}
