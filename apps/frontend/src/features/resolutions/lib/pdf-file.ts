import { RESOLUTION_PDF_MAX_BYTES, RESOLUTION_PDF_MIME_TYPE } from '@sigoa/shared';

export interface PdfCandidate {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

/**
 * Valida en el cliente el PDF firmado (D10): obligatorio, no vacío, PDF por tipo y extensión y
 * dentro del límite compartido con el servidor. El servidor repite la validación (firma `%PDF`).
 * Devuelve el mensaje para el usuario o `null` si el archivo es aceptable.
 */
export function validateResolutionPdf(file: PdfCandidate | null | undefined): string | null {
  if (!file) {
    return 'Selecciona el PDF firmado para aprobar.';
  }
  if (file.size === 0) {
    return 'El archivo está vacío. Selecciona el PDF firmado.';
  }
  const isPdf = file.type === RESOLUTION_PDF_MIME_TYPE && file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return 'El archivo debe ser un PDF (.pdf).';
  }
  if (file.size > RESOLUTION_PDF_MAX_BYTES) {
    return 'El PDF no puede pasar de 10 MB.';
  }
  return null;
}

/** Tamaño legible con `Intl` es-PE (p. ej. «1.5 MB»). */
export function formatFileSize(bytes: number): string {
  const format = (value: number) =>
    new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(value);
  if (bytes < 1024) {
    return `${format(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${format(bytes / 1024)} KB`;
  }
  return `${format(bytes / (1024 * 1024))} MB`;
}
