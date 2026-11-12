import crypto from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import { computeSha256 } from './file-hash.js';
import type { FileStorage, StoredFileInfo, UploadFileInput } from './file-storage.js';

export interface CloudinaryUploadOptions {
  public_id: string;
  resource_type: 'raw' | 'auto' | 'image';
  type: 'authenticated' | 'upload';
  folder?: string;
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  bytes: number;
  resource_type?: string;
}

export interface CloudinaryDestroyOptions {
  resource_type: 'raw' | 'auto' | 'image';
  type: 'authenticated' | 'upload';
}

export interface CloudinaryDownloadUrlOptions {
  resource_type?: 'raw' | 'auto' | 'image';
  type?: 'authenticated' | 'upload';
  expires_at?: number;
}

export interface CloudinaryClient {
  upload(buffer: Buffer, options: CloudinaryUploadOptions): Promise<CloudinaryUploadResult>;
  destroy(publicId: string, options: CloudinaryDestroyOptions): Promise<{ result: string }>;
  privateDownloadUrl(publicId: string, options: CloudinaryDownloadUrlOptions): string;
}

export interface CloudinaryFileStorageOptions {
  client: CloudinaryClient;
  urlTtlSeconds?: number;
  folder?: string;
  now?: () => number;
}

function resolveExtension(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    default:
      return 'bin';
  }
}

/**
 * Adaptador de FileStorage para Cloudinary con entrega autenticada
 * y URLs firmadas que expiran (RS-072, RNF-013).
 */
export class CloudinaryFileStorage implements FileStorage {
  private readonly client: CloudinaryClient;
  private readonly urlTtlSeconds: number;
  private readonly defaultFolder?: string;
  private readonly now: () => number;

  constructor(options: CloudinaryFileStorageOptions) {
    this.client = options.client;
    this.urlTtlSeconds = options.urlTtlSeconds ?? 300;
    this.defaultFolder = options.folder;
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async upload(input: UploadFileInput): Promise<StoredFileInfo> {
    const sha256 = computeSha256(input.content);
    const ext = resolveExtension(input.mimeType);
    const uuid = crypto.randomUUID();
    const folder = input.folder ?? this.defaultFolder;
    const publicId = folder ? `${folder}/${uuid}.${ext}` : `${uuid}.${ext}`;

    try {
      const result = await this.client.upload(input.content, {
        public_id: publicId,
        resource_type: 'raw',
        type: 'authenticated',
        folder,
      });

      return {
        provider: 'CLOUDINARY',
        publicId: result.public_id,
        url: result.secure_url,
        mimeType: input.mimeType,
        sizeBytes: input.content.byteLength,
        sha256,
      };
    } catch {
      throw new AppError(
        'Error al subir el archivo al almacenamiento en la nube.',
        'INTERNAL_ERROR',
        500,
      );
    }
  }

  getUrl(publicId: string): string {
    const expiresAt = this.now() + this.urlTtlSeconds;

    try {
      return this.client.privateDownloadUrl(publicId, {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: expiresAt,
      });
    } catch {
      throw new AppError(
        'Error al generar la dirección URL de descarga del archivo.',
        'INTERNAL_ERROR',
        500,
      );
    }
  }

  async delete(publicId: string): Promise<void> {
    try {
      await this.client.destroy(publicId, {
        resource_type: 'raw',
        type: 'authenticated',
      });
    } catch {
      throw new AppError(
        'Error al eliminar el archivo del almacenamiento en la nube.',
        'INTERNAL_ERROR',
        500,
      );
    }
  }
}
