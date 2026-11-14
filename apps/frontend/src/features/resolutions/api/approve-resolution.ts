import { resolutionDtoSchema, RESOLUTION_PDF_MIME_TYPE, type ResolutionDto } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/**
 * Aprueba la resolución con el PDF firmado (HU-048, CA2): el archivo viaja como cuerpo binario
 * `application/pdf` (el valor por defecto del cliente es JSON y se sobrescribe aquí).
 */
export async function approveResolution(resolutionId: string, file: Blob): Promise<ResolutionDto> {
  const response = await apiClient.post<unknown>(
    `/resolutions/${encodeURIComponent(resolutionId)}/approve`,
    file,
    { headers: { 'Content-Type': RESOLUTION_PDF_MIME_TYPE } },
  );
  return resolutionDtoSchema.parse(response.data);
}
