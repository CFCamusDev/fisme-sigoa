import { apiErrorResponseSchema } from '@sigoa/shared';
import { isAxiosError } from 'axios';
import { ApiError } from './api-error';

/** Extrae el nombre de archivo de una cabecera `Content-Disposition`, o devuelve `fallback`. */
export function parseFileNameFromDisposition(header: string | undefined, fallback: string): string {
  if (!header) {
    return fallback;
  }
  const match = /filename="?([^";]+)"?/i.exec(header);
  const extracted = match?.[1]?.trim();
  return extracted && extracted.length > 0 ? extracted : fallback;
}

/** Convierte una respuesta de error recibida como `Blob` en un `ApiError` tipado. */
export async function toBlobApiError(error: unknown, fallbackMessage: string): Promise<never> {
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
      message: fallbackMessage,
      status,
    });
  }

  throw error;
}

/** Dispara la descarga en el navegador de un `Blob` con el nombre de archivo indicado. */
export function saveBlobFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
