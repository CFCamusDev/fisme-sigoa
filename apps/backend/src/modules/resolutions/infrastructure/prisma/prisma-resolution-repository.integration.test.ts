import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { Resolution, type ResolutionPdf } from '../../domain/entities/resolution.js';
import type { ResolutionType } from '../../domain/entities/resolution-enums.js';
import { DuplicateResolutionError } from '../../domain/errors/index.js';
import { PrismaResolutionCatalogVersionReader } from './prisma-resolution-catalog-version-reader.js';
import { PrismaResolutionRepository } from './prisma-resolution-repository.js';

describe('PrismaResolutionRepository Integration (PostgreSQL real, T-048-19)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaResolutionRepository(uow);
  const versionReader = new PrismaResolutionCatalogVersionReader(uow);

  const ISSUED_ON = new Date('2026-11-10T00:00:00.000Z');

  async function seedVersion(id: string, status: 'DRAFT' | 'IN_VALIDATION' = 'IN_VALIDATION') {
    // Una versión abierta por programa (índice único parcial): cada versión va en su programa.
    const programId = `program-${id}`;
    await prisma.program.create({
      data: { id: programId, code: `EPIS-${id}`, name: `Programa ${id}`, faculty: 'FISME' },
    });
    return prisma.catalogVersion.create({ data: { id, programId, number: 1, status } });
  }

  function registered(
    id: string,
    overrides: { type?: ResolutionType; number?: string; versionId?: string; now?: Date } = {},
  ) {
    return Resolution.register({
      id,
      type: overrides.type ?? 'EDUCATIONAL_OBJECTIVE',
      number: overrides.number ?? `RD-${id}`,
      issuedOn: ISSUED_ON,
      catalogVersionId: overrides.versionId ?? 'v1',
      actorId: 'user-1',
      now: overrides.now,
    });
  }

  function pdf(fileId: string): ResolutionPdf {
    return {
      fileId,
      provider: 'memory',
      publicId: `resolutions/${fileId}`,
      url: `https://files.example.test/${fileId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      sha256: 'b'.repeat(64),
    };
  }

  it('saves a registered resolution with null pdf and approval data (incomplete but valid)', async () => {
    await seedVersion('v1');

    await repository.save(registered('r1'));

    const found = await repository.findById('r1');
    expect(found?.status).toBe('REGISTERED');
    expect(found?.number).toBe('RD-r1');
    expect(found?.issuedOn.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(found?.catalogVersionId).toBe('v1');
    expect(found?.pdfFileId).toBeNull();
    expect(found?.approvedAt).toBeNull();
    expect(found?.approvedBy).toBeNull();
    expect(found?.createdBy).toBe('user-1');
    expect(await repository.findById('missing')).toBeNull();
  }, 20_000);

  it('rejects a duplicated number for the same type but allows it for another type', async () => {
    await seedVersion('v1');
    await seedVersion('v2');
    await repository.save(registered('r1', { number: 'RD-1', versionId: 'v1' }));

    await expect(
      repository.save(registered('r2', { number: 'RD-1', versionId: 'v2' })),
    ).rejects.toBeInstanceOf(DuplicateResolutionError);

    await repository.save(
      registered('r3', { type: 'GRADUATE_ATTRIBUTE', number: 'RD-1', versionId: 'v1' }),
    );
    expect((await repository.list({ page: 1, pageSize: 10 })).total).toBe(2);
  }, 20_000);

  it('rejects a second resolution of the same type for the same version', async () => {
    await seedVersion('v1');
    await repository.save(registered('r1', { number: 'RD-1' }));

    await expect(repository.save(registered('r2', { number: 'RD-2' }))).rejects.toBeInstanceOf(
      DuplicateResolutionError,
    );

    await repository.save(registered('r3', { type: 'GRADUATE_ATTRIBUTE', number: 'RD-3' }));
    expect((await repository.list({ page: 1, pageSize: 10 })).total).toBe(2);
  }, 20_000);

  it('rejects a duplicated number and type under concurrency', async () => {
    await seedVersion('v1');
    await seedVersion('v2');
    await seedVersion('v3');
    await seedVersion('v4');
    await seedVersion('v5');
    const attempts = ['v1', 'v2', 'v3', 'v4', 'v5'].map((versionId, index) =>
      repository.save(registered(`r${index}`, { number: 'RD-SAME', versionId })),
    );

    const results = await Promise.allSettled(attempts);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected).toHaveLength(4);
    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(DuplicateResolutionError);
    }
    expect(await prisma.resolution.count({ where: { number: 'RD-SAME' } })).toBe(1);
  }, 20_000);

  describe('lockForApproval', () => {
    it('requires an active transaction', async () => {
      await expect(repository.lockForApproval('r1')).rejects.toThrow(/transacción activa/);
    }, 20_000);

    it('returns the locked resolution inside a transaction, or null when missing', async () => {
      await seedVersion('v1');
      await repository.save(registered('r1'));

      const [locked, missing] = await uow.run(async () => [
        await repository.lockForApproval('r1'),
        await repository.lockForApproval('missing'),
      ]);

      expect(locked?.id).toBe('r1');
      expect(missing).toBeNull();
    }, 20_000);
  });

  describe('approve', () => {
    it('requires an active transaction', async () => {
      await expect(repository.approve('r1', pdf('f1'), 'user-2', new Date())).rejects.toThrow(
        /transacción activa/,
      );
    }, 20_000);

    it('approves a registered resolution and stores its pdf', async () => {
      await seedVersion('v1');
      await repository.save(registered('r1'));
      const now = new Date('2026-11-14T09:00:00.000Z');

      const won = await uow.run(() => repository.approve('r1', pdf('f1'), 'user-2', now));

      expect(won).toBe(true);
      const found = await repository.findById('r1');
      expect(found?.status).toBe('APPROVED');
      expect(found?.pdfFileId).toBe('f1');
      expect(found?.approvedBy).toBe('user-2');
      expect(found?.approvedAt?.toISOString()).toBe(now.toISOString());
      const file = await prisma.storedFile.findUnique({ where: { id: 'f1' } });
      expect(file?.sha256).toBe('b'.repeat(64));
      expect(file?.sizeBytes).toBe(2048);
    }, 20_000);

    it('returns false and leaves no file when the resolution is no longer registered', async () => {
      await seedVersion('v1');
      await repository.save(registered('r1'));
      await uow.run(() => repository.approve('r1', pdf('f1'), 'user-2', new Date()));

      const won = await uow.run(() => repository.approve('r1', pdf('f2'), 'user-3', new Date()));

      expect(won).toBe(false);
      expect(await prisma.storedFile.findUnique({ where: { id: 'f2' } })).toBeNull();
      expect((await repository.findById('r1'))?.pdfFileId).toBe('f1');
      expect((await repository.findById('r1'))?.approvedBy).toBe('user-2');
    }, 20_000);

    it('rolls back the file and the state when the transaction fails', async () => {
      await seedVersion('v1');
      await repository.save(registered('r1'));

      await expect(
        uow.run(async () => {
          await repository.approve('r1', pdf('f1'), 'user-2', new Date());
          throw new Error('subscriber failed');
        }),
      ).rejects.toThrow('subscriber failed');

      expect((await repository.findById('r1'))?.status).toBe('REGISTERED');
      expect(await prisma.storedFile.findUnique({ where: { id: 'f1' } })).toBeNull();
    }, 20_000);
  });

  describe('list', () => {
    async function seedList() {
      await seedVersion('v1');
      await seedVersion('v2');
      await seedVersion('v3');
      await repository.save(
        registered('r1', {
          number: 'RD-1',
          versionId: 'v1',
          now: new Date('2026-11-01T10:00:00Z'),
        }),
      );
      await repository.save(
        registered('r2', {
          type: 'GRADUATE_ATTRIBUTE',
          number: 'RD-2',
          versionId: 'v2',
          now: new Date('2026-11-02T10:00:00Z'),
        }),
      );
      await repository.save(
        registered('r3', {
          number: 'RD-3',
          versionId: 'v3',
          now: new Date('2026-11-03T10:00:00Z'),
        }),
      );
      await uow.run(() => repository.approve('r3', pdf('f3'), 'user-2', new Date()));
    }

    it('lists the most recent first with the total', async () => {
      await seedList();

      const page = await repository.list({ page: 1, pageSize: 10 });

      expect(page.total).toBe(3);
      expect(page.items.map((item) => item.id)).toEqual(['r3', 'r2', 'r1']);
    }, 20_000);

    it('paginates without losing the total', async () => {
      await seedList();

      const second = await repository.list({ page: 2, pageSize: 2 });
      const beyond = await repository.list({ page: 3, pageSize: 2 });

      expect(second.total).toBe(3);
      expect(second.items.map((item) => item.id)).toEqual(['r1']);
      expect(beyond.items).toEqual([]);
      expect(beyond.total).toBe(3);
    }, 20_000);

    it('filters by type, status and catalog version', async () => {
      await seedList();

      const byType = await repository.list({ type: 'GRADUATE_ATTRIBUTE', page: 1, pageSize: 10 });
      const byStatus = await repository.list({ status: 'APPROVED', page: 1, pageSize: 10 });
      const byVersion = await repository.list({ catalogVersionId: 'v1', page: 1, pageSize: 10 });
      const combined = await repository.list({
        type: 'EDUCATIONAL_OBJECTIVE',
        status: 'REGISTERED',
        page: 1,
        pageSize: 10,
      });

      expect(byType.items.map((item) => item.id)).toEqual(['r2']);
      expect(byStatus.items.map((item) => item.id)).toEqual(['r3']);
      expect(byVersion.items.map((item) => item.id)).toEqual(['r1']);
      expect(combined.items.map((item) => item.id)).toEqual(['r1']);
      expect(combined.total).toBe(1);
    }, 20_000);

    it('returns an empty page when nothing matches', async () => {
      const page = await repository.list({ catalogVersionId: 'none', page: 1, pageSize: 10 });

      expect(page).toEqual({ items: [], total: 0 });
    }, 20_000);
  });

  describe('catalog version reader', () => {
    it('reads the id and status of a catalog version', async () => {
      await seedVersion('v1', 'IN_VALIDATION');
      await seedVersion('v2', 'DRAFT');

      expect(await versionReader.findById('v1')).toEqual({ id: 'v1', status: 'IN_VALIDATION' });
      expect(await versionReader.findById('v2')).toEqual({ id: 'v2', status: 'DRAFT' });
      expect(await versionReader.findById('missing')).toBeNull();
    }, 20_000);
  });
});
