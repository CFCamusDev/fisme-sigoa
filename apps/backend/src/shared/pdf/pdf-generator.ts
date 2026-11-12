export interface PdfMarginOptions {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

export interface PdfRenderOptions {
  format?: 'A4' | 'Letter';
  printBackground?: boolean;
  margin?: PdfMarginOptions;
  headerTemplate?: string;
  footerTemplate?: string;
  displayHeaderFooter?: boolean;
}

export interface PdfRenderInput {
  html: string;
  options?: PdfRenderOptions;
}

export interface PdfGenerator {
  render(input: PdfRenderInput): Promise<Buffer>;
  close(): Promise<void>;
}
