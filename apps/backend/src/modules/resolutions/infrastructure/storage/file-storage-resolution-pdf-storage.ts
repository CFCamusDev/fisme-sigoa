import type { FileStorage } from '../../../../shared/storage/file-storage.js';
import type {
  ResolutionPdfStorage,
  ResolutionPdfUpload,
  ResolutionPdfUploadInput,
} from '../../domain/ports/resolution-pdf-storage.js';

export const RESOLUTION_PDF_FOLDER = 'resolutions';
const PDF_MIME_TYPE = 'application/pdf';

/** Adaptador del puerto sobre el `FileStorage` transversal (Cloudinary en producción). */
export class FileStorageResolutionPdfStorage implements ResolutionPdfStorage {
  constructor(private readonly fileStorage: FileStorage) {}

  async upload(input: ResolutionPdfUploadInput): Promise<ResolutionPdfUpload> {
    const stored = await this.fileStorage.upload({
      content: input.content,
      originalName: input.originalName,
      mimeType: PDF_MIME_TYPE,
      folder: RESOLUTION_PDF_FOLDER,
    });
    return {
      provider: stored.provider,
      publicId: stored.publicId,
      url: stored.url,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
    };
  }

  async discard(publicId: string): Promise<void> {
    await this.fileStorage.delete(publicId);
  }
}
