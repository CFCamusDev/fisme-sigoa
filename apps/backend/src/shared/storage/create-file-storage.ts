import { v2 as cloudinary } from 'cloudinary';
import type { Env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';
import { CloudinaryFileStorage, type CloudinaryClient } from './cloudinary-file-storage.js';
import type { FileStorage } from './file-storage.js';
import { InMemoryFileStorage } from './in-memory-file-storage.js';

export interface CreateFileStorageOptions {
  urlTtlSeconds?: number;
  folder?: string;
  client?: CloudinaryClient;
}

export function createCloudinarySdkClient(env: Env): CloudinaryClient {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return {
    async upload(buffer, options) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: options.public_id,
            resource_type: options.resource_type,
            type: options.type,
            folder: options.folder,
          },
          (error, result) => {
            if (error || !result) {
              return reject(error ?? new Error('Respuesta no válida de Cloudinary'));
            }
            resolve({
              public_id: result.public_id,
              secure_url: result.secure_url,
              bytes: result.bytes,
              resource_type: result.resource_type,
            });
          },
        );

        uploadStream.end(buffer);
      });
    },

    async destroy(publicId, options) {
      const res = await cloudinary.uploader.destroy(publicId, {
        resource_type: options.resource_type,
        type: options.type,
      });
      return { result: typeof res === 'object' && res ? (res.result as string) : 'ok' };
    },

    privateDownloadUrl(publicId, options) {
      return cloudinary.utils.private_download_url(publicId, '', {
        resource_type: options.resource_type,
        type: options.type,
        expires_at: options.expires_at,
      });
    },
  };
}

export function createFileStorage(env: Env, options: CreateFileStorageOptions = {}): FileStorage {
  if (env.FILE_STORAGE_PROVIDER === 'memory') {
    if (env.NODE_ENV === 'production') {
      throw new AppError(
        'El proveedor de almacenamiento de archivos en memoria no está permitido en producción.',
        'INTERNAL_ERROR',
        500,
      );
    }
    return new InMemoryFileStorage();
  }

  if (env.FILE_STORAGE_PROVIDER === 'cloudinary') {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw new AppError(
        'Las credenciales de Cloudinary (CLOUD_NAME, API_KEY, API_SECRET) son obligatorias cuando FILE_STORAGE_PROVIDER es "cloudinary".',
        'INTERNAL_ERROR',
        500,
      );
    }

    const client = options.client ?? createCloudinarySdkClient(env);

    return new CloudinaryFileStorage({
      client,
      urlTtlSeconds: options.urlTtlSeconds ?? 300,
      folder: options.folder,
    });
  }

  throw new AppError(
    `Proveedor de almacenamiento de archivos no soportado: ${String(env.FILE_STORAGE_PROVIDER)}`,
    'INTERNAL_ERROR',
    500,
  );
}
