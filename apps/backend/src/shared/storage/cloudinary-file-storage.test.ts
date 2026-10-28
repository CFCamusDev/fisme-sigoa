import { describe, it, expect } from 'vitest';
import {
  CloudinaryFileStorage,
  type CloudinaryClient,
  type CloudinaryUploadOptions,
} from './cloudinary-file-storage.js';
import { describeFileStorageContract } from './file-storage.integration.test.js';
import { computeSha256 } from './file-hash.js';
import { AppError } from '../errors/app-error.js';

interface FakeResource {
  buffer: Buffer;
  options: CloudinaryUploadOptions;
}

function createFakeCloudinaryClient(): {
  client: CloudinaryClient;
  uploadedResources: Map<string, FakeResource>;
  destroyedResources: string[];
} {
  const uploadedResources = new Map<string, FakeResource>();
  const destroyedResources: string[] = [];

  const client: CloudinaryClient = {
    async upload(buffer, options) {
      const publicId = options.public_id;
      uploadedResources.set(publicId, { buffer, options });
      return {
        public_id: publicId,
        secure_url: `https://res.cloudinary.com/fake-cloud/raw/authenticated/${publicId}`,
        bytes: buffer.byteLength,
        resource_type: options.resource_type,
      };
    },
    async destroy(publicId) {
      destroyedResources.push(publicId);
      uploadedResources.delete(publicId);
      return { result: 'ok' };
    },
    privateDownloadUrl(publicId, options) {
      const expiresAt = options.expires_at ?? 0;
      return `https://res.cloudinary.com/fake-cloud/raw/authenticated/${publicId}?s=signed-sig&expires_at=${expiresAt}`;
    },
  };

  return { client, uploadedResources, destroyedResources };
}

describe('CloudinaryFileStorage (RS-072, RNF-013)', () => {
  it('returns url, publicId and the SHA-256 of the uploaded content (CA2)', async () => {
    const { client } = createFakeCloudinaryClient();
    const storage = new CloudinaryFileStorage({ client });

    const content = Buffer.from('%PDF-1.4\nPrueba de contenido evaluativo');
    const result = await storage.upload({
      content,
      originalName: 'evidencia.pdf',
      mimeType: 'application/pdf',
      folder: 'evidencias',
    });

    expect(result.provider).toBe('CLOUDINARY');
    expect(result.publicId).toBeDefined();
    expect(result.publicId).toContain('evidencias/');
    expect(result.publicId.endsWith('.pdf')).toBe(true);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.sizeBytes).toBe(content.byteLength);
    expect(result.sha256).toBe(computeSha256(content));
    expect(result.url).toBe(
      `https://res.cloudinary.com/fake-cloud/raw/authenticated/${result.publicId}`,
    );
  });

  it('getUrl returns a signed url that expires', async () => {
    const { client } = createFakeCloudinaryClient();
    let currentTime = 1700000000;
    const nowFn = () => currentTime;

    const storage = new CloudinaryFileStorage({
      client,
      urlTtlSeconds: 300,
      now: nowFn,
    });

    const url1 = storage.getUrl('evidencias/test-id.pdf');
    expect(url1).toContain('expires_at=1700000300');
    expect(url1).toContain('s=signed-sig');

    // Al avanzar el tiempo, la URL generada expira en un momento posterior
    currentTime = 1700001000;
    const url2 = storage.getUrl('evidencias/test-id.pdf');
    expect(url2).toContain('expires_at=1700001300');
    expect(url2).not.toBe(url1);
  });

  it('upload uses authenticated delivery and raw resource_type', async () => {
    const { client, uploadedResources } = createFakeCloudinaryClient();
    const storage = new CloudinaryFileStorage({ client });

    const content = Buffer.from('png-data');
    const result = await storage.upload({
      content,
      originalName: 'foto.png',
      mimeType: 'image/png',
    });

    const stored = uploadedResources.get(result.publicId);
    expect(stored).toBeDefined();
    expect(stored?.options.type).toBe('authenticated');
    expect(stored?.options.resource_type).toBe('raw');
  });

  it('publicId is distinct on two uploads of identical content', async () => {
    const { client } = createFakeCloudinaryClient();
    const storage = new CloudinaryFileStorage({ client });

    const content = Buffer.from('mismo contenido');
    const res1 = await storage.upload({
      content,
      originalName: 'a.pdf',
      mimeType: 'application/pdf',
    });
    const res2 = await storage.upload({
      content,
      originalName: 'b.pdf',
      mimeType: 'application/pdf',
    });

    expect(res1.publicId).not.toBe(res2.publicId);
    expect(res1.sha256).toBe(res2.sha256);
  });

  it('delete is idempotent when resource does not exist or was deleted', async () => {
    const { client, destroyedResources } = createFakeCloudinaryClient();
    const storage = new CloudinaryFileStorage({ client });

    await expect(storage.delete('recurso-inexistente.pdf')).resolves.toBeUndefined();
    expect(destroyedResources).toContain('recurso-inexistente.pdf');
  });

  it('maps provider upload error to AppError in Spanish without sensitive details', async () => {
    const failingClient: CloudinaryClient = {
      async upload() {
        throw new Error('API Key secret_xyz is invalid');
      },
      async destroy() {
        return { result: 'ok' };
      },
      privateDownloadUrl() {
        return '';
      },
    };

    const storage = new CloudinaryFileStorage({ client: failingClient });

    await expect(
      storage.upload({
        content: Buffer.from('data'),
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow(AppError);

    try {
      await storage.upload({
        content: Buffer.from('data'),
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
      });
    } catch (err: unknown) {
      const appErr = err as AppError;
      expect(appErr.message).toBe('Error al subir el archivo al almacenamiento en la nube.');
      expect(appErr.message).not.toContain('secret_xyz');
    }
  });

  it('maps provider delete error to AppError in Spanish', async () => {
    const failingClient: CloudinaryClient = {
      async upload() {
        return { public_id: 'x', secure_url: 'u', bytes: 1 };
      },
      async destroy() {
        throw new Error('Network timeout');
      },
      privateDownloadUrl() {
        return '';
      },
    };

    const storage = new CloudinaryFileStorage({ client: failingClient });

    await expect(storage.delete('doc.pdf')).rejects.toThrow(AppError);
  });

  // Verificación de suite de contrato reutilizable
  describeFileStorageContract('cloudinary (fake client)', () => {
    const { client } = createFakeCloudinaryClient();
    return new CloudinaryFileStorage({ client });
  });
});
