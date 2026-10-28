import { describe, expect, it } from 'vitest';
import { computeSha256 } from './file-hash.js';
import type { FileStorage, StoredFileInfo, UploadFileInput } from './file-storage.js';
import { InMemoryFileStorage } from './in-memory-file-storage.js';

/**
 * Suite de contrato parametrizable para FileStorage (RS-072, RNF-013).
 *
 * Reutilizable en el Tramo 2 con el adaptador real de Cloudinary.
 */
export function describeFileStorageContract(
  adapterName: string,
  factory: () => Promise<FileStorage> | FileStorage,
): void {
  describe(`FileStorage Contract: ${adapterName}`, () => {
    it('returns url and hash on upload', async () => {
      const storage = await factory();
      const content = Buffer.from('%PDF-1.4\nEvidencia de medicion de atributo del graduado');
      const input: UploadFileInput = {
        content,
        originalName: 'rubrica-evaluada.pdf',
        mimeType: 'application/pdf',
        folder: 'evidences',
      };

      const result: StoredFileInfo = await storage.upload(input);

      expect(result).toBeDefined();
      expect(result.url).toBeDefined();
      expect(typeof result.url).toBe('string');
      expect(result.url.length).toBeGreaterThan(0);
      expect(result.publicId).toBeDefined();
      expect(typeof result.publicId).toBe('string');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.sizeBytes).toBe(content.length);
      expect(result.sha256).toBe(computeSha256(content));
    });

    it('returns consistent url from getUrl(publicId)', async () => {
      const storage = await factory();
      const content = Buffer.from('archivo de acta');
      const uploaded = await storage.upload({
        content,
        originalName: 'acta.pdf',
        mimeType: 'application/pdf',
      });

      const url = storage.getUrl(uploaded.publicId);
      expect(url).toBe(uploaded.url);
    });

    it('uploads and deletes a file idempotently', async () => {
      const storage = await factory();
      const uploaded = await storage.upload({
        content: Buffer.from('temporal'),
        originalName: 'temp.png',
        mimeType: 'image/png',
      });

      await expect(storage.delete(uploaded.publicId)).resolves.toBeUndefined();
      // Eliminar nuevamente no debe arrojar error (idempotencia)
      await expect(storage.delete(uploaded.publicId)).resolves.toBeUndefined();
    });

    it('allows an application use-case to depend solely on FileStorage interface (CA2)', async () => {
      // Caso de uso de ejemplo desacoplado que satisface CA2
      class AttachEvidenceUseCase {
        constructor(private readonly fileStorage: FileStorage) {}

        async execute(file: { buffer: Buffer; filename: string }): Promise<StoredFileInfo> {
          return this.fileStorage.upload({
            content: file.buffer,
            originalName: file.filename,
            mimeType: 'application/pdf',
            folder: 'course-measurements',
          });
        }
      }

      const storage = await factory();
      const useCase = new AttachEvidenceUseCase(storage);
      const samplePdf = Buffer.from('%PDF-1.4\nmuestra');

      const stored = await useCase.execute({
        buffer: samplePdf,
        filename: 'muestra.pdf',
      });

      expect(stored.publicId).toBeDefined();
      expect(stored.sha256).toBe(computeSha256(samplePdf));
    });
  });
}

// Ejecución del contrato con el adaptador en memoria (sin servicios externos ni BD)
describeFileStorageContract('InMemoryFileStorage', () => new InMemoryFileStorage());
