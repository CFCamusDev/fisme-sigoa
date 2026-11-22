import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaResolutionApprovedPreconditionProvider } from './prisma-resolution-approved-precondition-provider.js';

describe('PrismaResolutionApprovedPreconditionProvider Integration (PostgreSQL real)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const provider = new PrismaResolutionApprovedPreconditionProvider(uow);

  async function seedCatalogVersion(id = 'cv-1', number = 1, programId = 'prog-1') {
    await prisma.program.upsert({
      where: { id: programId },
      update: {},
      create: {
        id: programId,
        code: `EPIS-${programId}`,
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });

    await prisma.catalogVersion.create({
      data: {
        id,
        programId,
        number,
        status: 'APPROVED',
      },
    });
  }

  async function seedPdfFile(id = 'file-1') {
    await prisma.storedFile.create({
      data: {
        id,
        provider: 'cloudinary',
        publicId: `resolutions/${id}`,
        url: `https://example.test/${id}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: `sha-${id}`,
      },
    });
  }

  it('is met for an approved resolution of the same catalog version with a PDF', async () => {
    await seedCatalogVersion('cv-1', 1);
    await seedPdfFile('file-1');

    await prisma.resolution.create({
      data: {
        id: 'res-1',
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'R-001-2027',
        issuedOn: new Date('2027-01-15T00:00:00.000Z'),
        status: 'APPROVED',
        catalogVersionId: 'cv-1',
        pdfFileId: 'file-1',
        approvedAt: new Date('2027-01-16T00:00:00.000Z'),
        approvedBy: 'user-1',
        createdBy: 'user-1',
      },
    });

    const result = await provider.evaluate({ type: 'P611', catalogVersionId: 'cv-1' });
    expect(result).toEqual([
      {
        code: 'RESOLUTION_APPROVED',
        label: 'La resolución que aprueba el proceso está aprobada con su PDF',
        state: 'MET',
      },
    ]);
  }, 5_000);

  it('is unmet when the resolution is only registered', async () => {
    await seedCatalogVersion('cv-reg', 2);

    await prisma.resolution.create({
      data: {
        id: 'res-reg',
        type: 'GRADUATE_ATTRIBUTE',
        number: 'R-002-2027',
        issuedOn: new Date('2027-01-15T00:00:00.000Z'),
        status: 'REGISTERED',
        catalogVersionId: 'cv-reg',
        createdBy: 'user-1',
      },
    });

    const result = await provider.evaluate({ type: 'P621', catalogVersionId: 'cv-reg' });
    expect(result[0]?.state).toBe('UNMET');
  }, 5_000);

  it('is unmet when the PDF is missing', async () => {
    await seedCatalogVersion('cv-nopdf', 3);

    await prisma.resolution.create({
      data: {
        id: 'res-nopdf',
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'R-003-2027',
        issuedOn: new Date('2027-01-15T00:00:00.000Z'),
        status: 'APPROVED',
        catalogVersionId: 'cv-nopdf',
        pdfFileId: null,
        approvedAt: new Date('2027-01-16T00:00:00.000Z'),
        approvedBy: 'user-1',
        createdBy: 'user-1',
      },
    });

    const result = await provider.evaluate({ type: 'P613', catalogVersionId: 'cv-nopdf' });
    expect(result[0]?.state).toBe('UNMET');
  }, 5_000);

  it('ignores an approved resolution of another version or type', async () => {
    await seedCatalogVersion('cv-target', 4);
    await seedCatalogVersion('cv-other', 5);
    await seedPdfFile('file-other');
    await seedPdfFile('file-wrong-type');

    await prisma.resolution.create({
      data: {
        id: 'res-other-version',
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'R-004-2027',
        issuedOn: new Date('2027-01-15T00:00:00.000Z'),
        status: 'APPROVED',
        catalogVersionId: 'cv-other',
        pdfFileId: 'file-other',
        approvedAt: new Date('2027-01-16T00:00:00.000Z'),
        approvedBy: 'user-1',
        createdBy: 'user-1',
      },
    });

    await prisma.resolution.create({
      data: {
        id: 'res-wrong-type',
        type: 'GRADUATE_ATTRIBUTE',
        number: 'R-005-2027',
        issuedOn: new Date('2027-01-15T00:00:00.000Z'),
        status: 'APPROVED',
        catalogVersionId: 'cv-target',
        pdfFileId: 'file-wrong-type',
        approvedAt: new Date('2027-01-16T00:00:00.000Z'),
        approvedBy: 'user-1',
        createdBy: 'user-1',
      },
    });

    const result = await provider.evaluate({ type: 'P611', catalogVersionId: 'cv-target' });
    expect(result[0]?.state).toBe('UNMET');
  }, 5_000);

  it('is not verifiable for measurement processes', async () => {
    for (const type of ['P612', 'P622', 'P623'] as const) {
      const result = await provider.evaluate({ type, catalogVersionId: 'cv-any' });
      expect(result[0]?.state).toBe('NOT_VERIFIABLE');
    }
  }, 5_000);
});
