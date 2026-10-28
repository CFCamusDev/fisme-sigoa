import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/db/use-test-database.js';

describe('StoredFile Integration (PostgreSQL real, LS s.4.13, RS-072)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('inserts and retrieves a stored file record with automatic createdAt and cuid id', async () => {
    const file = await prisma.storedFile.create({
      data: {
        provider: 'CLOUDINARY',
        publicId: 'evidences/2026-1/sample-file.pdf',
        url: 'https://res.cloudinary.com/fake-cloud/raw/upload/v1234/sample.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    });

    expect(file.id).toBeDefined();
    expect(typeof file.id).toBe('string');
    expect(file.provider).toBe('CLOUDINARY');
    expect(file.publicId).toBe('evidences/2026-1/sample-file.pdf');
    expect(file.url).toContain('https://res.cloudinary.com');
    expect(file.mimeType).toBe('application/pdf');
    expect(file.sizeBytes).toBe(1024);
    expect(file.sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(file.createdAt).toBeInstanceOf(Date);

    const fetched = await prisma.storedFile.findUnique({
      where: {
        provider_publicId: {
          provider: 'CLOUDINARY',
          publicId: 'evidences/2026-1/sample-file.pdf',
        },
      },
    });

    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(file.id);
  });

  it('enforces composite uniqueness on provider and publicId', async () => {
    await prisma.storedFile.create({
      data: {
        provider: 'IN_MEMORY',
        publicId: 'unique-file-1.png',
        url: 'memory://unique-file-1.png',
        mimeType: 'image/png',
        sizeBytes: 512,
        sha256: 'a1b2c3d4e5f60000000000000000000000000000000000000000000000000000',
      },
    });

    // Intentar insertar exactamente la misma combinación de proveedor y publicId debe fallar por unicidad
    await expect(
      prisma.storedFile.create({
        data: {
          provider: 'IN_MEMORY',
          publicId: 'unique-file-1.png',
          url: 'memory://different-url.png',
          mimeType: 'image/png',
          sizeBytes: 256,
          sha256: 'f6e5d4c3b2a10000000000000000000000000000000000000000000000000000',
        },
      }),
    ).rejects.toThrowError(/Unique constraint failed/);

    // Mismo publicId pero con distinto proveedor SÍ está permitido
    const diffProvider = await prisma.storedFile.create({
      data: {
        provider: 'LOCAL_DISK',
        publicId: 'unique-file-1.png',
        url: 'file:///data/unique-file-1.png',
        mimeType: 'image/png',
        sizeBytes: 512,
        sha256: 'a1b2c3d4e5f60000000000000000000000000000000000000000000000000000',
      },
    });

    expect(diffProvider.id).toBeDefined();
  });
});
