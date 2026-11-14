import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import {
  createCatalogFixture,
  createDraftCatalogVersion,
} from '../../../../test/factories/catalog.js';
import { PrismaCatalogVersionHistoryReader } from './prisma-catalog-version-history-reader.js';

describe('PrismaCatalogVersionHistoryReader Integration (PostgreSQL real, HU-017, T-017-10)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const reader = new PrismaCatalogVersionHistoryReader(new PrismaUnitOfWork(prisma));

  it('groups the OE and AG resolutions by version and flags the PDF', async () => {
    const fixture = await createCatalogFixture(prisma, { programId: 'history-program' });
    const v1 = fixture.currentVersionId as string;
    const v2 = await createDraftCatalogVersion(prisma, fixture);
    const file = await prisma.storedFile.create({
      data: {
        provider: 'memory',
        publicId: 'history-test/resolution.pdf',
        url: 'memory://history-test/resolution.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
        sha256: 'a'.repeat(64),
      },
    });
    await prisma.resolution.create({
      data: {
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'H-001/2024',
        issuedOn: new Date('2024-02-20T00:00:00.000Z'),
        status: 'APPROVED',
        approvedAt: new Date('2024-03-01T10:00:00.000Z'),
        approvedBy: 'SEED',
        pdfFileId: file.id,
        catalogVersionId: v1,
        createdBy: 'SEED',
      },
    });
    await prisma.resolution.create({
      data: {
        type: 'GRADUATE_ATTRIBUTE',
        number: 'H-002/2026',
        issuedOn: new Date('2026-05-02T00:00:00.000Z'),
        catalogVersionId: v2,
        createdBy: 'SEED',
      },
    });

    const result = await reader.listForProgram('history-program');

    expect([...result.keys()].sort()).toEqual([v1, v2].sort());
    expect(result.get(v1)).toEqual([
      {
        id: expect.any(String),
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'H-001/2024',
        issuedOn: new Date('2024-02-20T00:00:00.000Z'),
        status: 'APPROVED',
        approvedAt: new Date('2024-03-01T10:00:00.000Z'),
        hasPdf: true,
      },
    ]);
    expect(result.get(v2)).toMatchObject([
      { type: 'GRADUATE_ATTRIBUTE', status: 'REGISTERED', approvedAt: null, hasPdf: false },
    ]);
  }, 30_000);

  it('does not return resolutions of other programs or versions without resolution', async () => {
    const mine = await createCatalogFixture(prisma, { programId: 'history-mine' });
    const theirs = await createCatalogFixture(prisma, { programId: 'history-theirs' });
    await prisma.resolution.create({
      data: {
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'H-009/2026',
        issuedOn: new Date('2026-05-02T00:00:00.000Z'),
        catalogVersionId: theirs.currentVersionId,
        createdBy: 'SEED',
      },
    });

    const result = await reader.listForProgram(mine.programId);

    expect(result.size).toBe(0);
  }, 30_000);
});
