import type { PdfRenderOptions } from './pdf-generator.js';

export const EMPTY_PDF_HEADER_TEMPLATE = '<span></span>';

/**
 * Añade una plantilla de encabezado vacía cuando `displayHeaderFooter` está activo para evitar
 * que Chromium imprima la fecha y la URL del navegador en la parte superior del PDF.
 */
export function withEmptyPdfHeader(options: PdfRenderOptions): PdfRenderOptions {
  if (!options.displayHeaderFooter) {
    return options;
  }
  return {
    ...options,
    headerTemplate: options.headerTemplate ?? EMPTY_PDF_HEADER_TEMPLATE,
  };
}
