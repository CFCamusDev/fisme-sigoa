export interface UploadFileInput {
  content: Buffer;
  originalName: string;
  mimeType: string;
  folder?: string;
}

export interface StoredFileInfo {
  provider: string;
  publicId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export interface FileStorage {
  upload(input: UploadFileInput): Promise<StoredFileInfo>;
  getUrl(publicId: string): string;
  delete(publicId: string): Promise<void>;
}
