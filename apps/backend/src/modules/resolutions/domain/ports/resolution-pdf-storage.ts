export interface ResolutionPdfUploadInput {
  readonly content: Buffer;
  readonly originalName: string;
}

export interface ResolutionPdfUpload {
  readonly provider: string;
  readonly publicId: string;
  readonly url: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface ResolutionPdfStorage {
  /** Sube el PDF ya validado y devuelve sus datos (con hash SHA-256, RS-072). */
  upload(input: ResolutionPdfUploadInput): Promise<ResolutionPdfUpload>;
  /** Elimina un archivo subido cuando la aprobación no se confirma (compensación, D4). */
  discard(publicId: string): Promise<void>;
}
