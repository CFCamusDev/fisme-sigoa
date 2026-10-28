import { beforeEach, describe, expect, it } from 'vitest';
import { computeSha256 } from './file-hash.js';
import { InMemoryFileStorage } from './in-memory-file-storage.js';

describe('InMemoryFileStorage', () => {
  let storage: InMemoryFileStorage;

  beforeEach(() => {
    storage = new InMemoryFileStorage();
  });

  it('starts empty', () => {
    expect(storage.size).toBe(0);
  });

  it('uploads a file and returns StoredFileInfo with real sha256 and memory url', async () => {
    const content = Buffer.from('Contenido de prueba');
    const result = await storage.upload({
      content,
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
    });

    expect(result.provider).toBe('in-memory');
    expect(result.publicId).toBe('file-1');
    expect(result.url).toBe('memory://file-1');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.sizeBytes).toBe(content.length);
    expect(result.sha256).toBe(computeSha256(content));

    expect(storage.size).toBe(1);
    expect(storage.hasFile('file-1')).toBe(true);
    expect(storage.getFile('file-1')).toEqual(content);
  });

  it('supports target folder in publicId', async () => {
    const result = await storage.upload({
      content: Buffer.from('data'),
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
      folder: 'evidences/2026-1',
    });

    expect(result.publicId).toBe('evidences/2026-1/file-1');
    expect(result.url).toBe('memory://evidences/2026-1/file-1');
    expect(storage.hasFile('evidences/2026-1/file-1')).toBe(true);
  });

  it('returns matching memory url from getUrl(publicId)', () => {
    expect(storage.getUrl('custom-file')).toBe('memory://custom-file');
  });

  it('deletes an uploaded file idempotently', async () => {
    const result = await storage.upload({
      content: Buffer.from('temp'),
      originalName: 'temp.png',
      mimeType: 'image/png',
    });

    expect(storage.hasFile(result.publicId)).toBe(true);
    await storage.delete(result.publicId);
    expect(storage.hasFile(result.publicId)).toBe(false);
    expect(storage.size).toBe(0);

    // Idempotent delete on non-existent file
    await expect(storage.delete(result.publicId)).resolves.toBeUndefined();
  });

  it('clears all files on clear()', async () => {
    await storage.upload({
      content: Buffer.from('1'),
      originalName: '1.pdf',
      mimeType: 'application/pdf',
    });
    await storage.upload({
      content: Buffer.from('2'),
      originalName: '2.pdf',
      mimeType: 'application/pdf',
    });

    expect(storage.size).toBe(2);
    storage.clear();
    expect(storage.size).toBe(0);

    const next = await storage.upload({
      content: Buffer.from('3'),
      originalName: '3.pdf',
      mimeType: 'application/pdf',
    });
    expect(next.publicId).toBe('file-1');
  });
});
