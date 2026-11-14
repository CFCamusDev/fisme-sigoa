/**
 * Convierte una cadena PDF en base64 a una URL `blob:` para previsualizar en `<iframe>` o pestaña nueva.
 */
export function createPdfObjectUrl(pdfBase64: string): string {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

/** Revoca una URL `blob:` generada previamente si existe. */
export function revokePdfObjectUrl(url: string | null | undefined): void {
  if (url) {
    URL.revokeObjectURL(url);
  }
}
