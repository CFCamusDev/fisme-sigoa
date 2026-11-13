import { describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '../../../../shared/storage/in-memory-file-storage.js';
import {
  FileStorageResolutionPdfStorage,
  RESOLUTION_PDF_FOLDER,
} from './file-storage-resolution-pdf-storage.js';

const CONTENT = Buffer.from('%PDF-1.4\n% prueba\n');

describe('FileStorageResolutionPdfStorage', () => {
  it('uploads the pdf to the resolutions folder with its hash and size', async () => {
    const fileStorage = new InMemoryFileStorage();
    const storage = new FileStorageResolutionPdfStorage(fileStorage);

    const uploaded = await storage.upload({ content: CONTENT, originalName: 'resolucion.pdf' });

    expect(uploaded.publicId.startsWith(`${RESOLUTION_PDF_FOLDER}/`)).toBe(true);
    expect(uploaded.mimeType).toBe('application/pdf');
    expect(uploaded.sizeBytes).toBe(CONTENT.length);
    expect(uploaded.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(fileStorage.hasFile(uploaded.publicId)).toBe(true);
  });

  it('discards an uploaded file', async () => {
    const fileStorage = new InMemoryFileStorage();
    const storage = new FileStorageResolutionPdfStorage(fileStorage);
    const uploaded = await storage.upload({ content: CONTENT, originalName: 'resolucion.pdf' });

    await storage.discard(uploaded.publicId);

    expect(fileStorage.hasFile(uploaded.publicId)).toBe(false);
    expect(fileStorage.size).toBe(0);
  });
});
