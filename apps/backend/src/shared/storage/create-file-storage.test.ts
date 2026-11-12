import { describe, it, expect } from 'vitest';
import { createFileStorage } from './create-file-storage.js';
import { InMemoryFileStorage } from './in-memory-file-storage.js';
import { CloudinaryFileStorage, type CloudinaryClient } from './cloudinary-file-storage.js';
import { createTestEnv } from '../../test/test-env.js';
import { AppError } from '../errors/app-error.js';

describe('createFileStorage factory (RS-072, RNF-033)', () => {
  it('returns InMemoryFileStorage when FILE_STORAGE_PROVIDER is memory outside production', () => {
    const env = createTestEnv({
      NODE_ENV: 'test',
      FILE_STORAGE_PROVIDER: 'memory',
    });

    const storage = createFileStorage(env);
    expect(storage).toBeInstanceOf(InMemoryFileStorage);
  });

  it('throws AppError when FILE_STORAGE_PROVIDER is memory in production', () => {
    const env = createTestEnv({
      NODE_ENV: 'production',
      FILE_STORAGE_PROVIDER: 'memory',
    });

    expect(() => createFileStorage(env)).toThrow(AppError);
  });

  it('returns CloudinaryFileStorage when FILE_STORAGE_PROVIDER is cloudinary', () => {
    const env = createTestEnv({
      FILE_STORAGE_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'untrm-sigoa',
      CLOUDINARY_API_KEY: '123456789012345',
      CLOUDINARY_API_SECRET: 'abcdefghijklmnopqrstuvwxyz0',
    });

    const mockClient: CloudinaryClient = {
      async upload() {
        return { public_id: '1', secure_url: 'u', bytes: 1 };
      },
      async destroy() {
        return { result: 'ok' };
      },
      privateDownloadUrl() {
        return 'url';
      },
    };

    const storage = createFileStorage(env, { client: mockClient });
    expect(storage).toBeInstanceOf(CloudinaryFileStorage);
  });

  it('throws AppError when FILE_STORAGE_PROVIDER is cloudinary but credentials are missing', () => {
    const env = createTestEnv({
      FILE_STORAGE_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: undefined,
      CLOUDINARY_API_KEY: undefined,
      CLOUDINARY_API_SECRET: undefined,
    });

    expect(() => createFileStorage(env)).toThrow(AppError);
  });
});
