import { describe, expect, it, vi } from 'vitest';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { InMemoryFileStorage } from '../../../../shared/storage/in-memory-file-storage.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { ApproveResolutionUseCase } from '../../application/approve-resolution.js';
import type { ResolutionApproved } from '../../domain/entities/resolution-approved.js';
import { InvalidResolutionTransitionError } from '../../domain/errors/index.js';
import type { ResolutionPermissionChecker } from '../../domain/ports/resolution-permission-checker.js';
import { InProcessResolutionEventPublisher } from '../events/in-process-resolution-event-publisher.js';
import { FileStorageResolutionPdfStorage } from '../storage/file-storage-resolution-pdf-storage.js';
import { PrismaResolutionRepository } from './prisma-resolution-repository.js';

const PDF_CONTENT = Buffer.from('%PDF-1.4\n% resolucion firmada de prueba\n');
const allowAll: ResolutionPermissionChecker = { assertAllowed: async () => undefined };

describe('ApproveResolutionUseCase Integration (PostgreSQL real, T-048-18, RF-048)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const repository = new PrismaResolutionRepository(uow);

  function build(subscribers: Array<(event: ResolutionApproved) => Promise<void>> = []) {
    const fileStorage = new InMemoryFileStorage();
    const useCase = new ApproveResolutionUseCase({
      resolutionRepository: repository,
      pdfStorage: new FileStorageResolutionPdfStorage(fileStorage),
      eventPublisher: new InProcessResolutionEventPublisher(subscribers),
      permissionChecker: allowAll,
      unitOfWork: uow,
      auditLogger: auditServices.auditLogger,
    });
    return { useCase, fileStorage };
  }

  async function registeredResolution() {
    await prisma.program.create({
      data: { id: 'p1', code: 'EPIS-p1', name: 'Programa p1', faculty: 'FISME' },
    });
    await prisma.catalogVersion.create({
      data: { id: 'v1', programId: 'p1', number: 1, status: 'IN_VALIDATION' },
    });
    return await prisma.resolution.create({
      data: {
        id: 'r1',
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'RD-012/2027',
        issuedOn: new Date('2026-11-10T00:00:00.000Z'),
        catalogVersionId: 'v1',
        createdBy: 'user-1',
      },
    });
  }

  const file = {
    content: PDF_CONTENT,
    originalName: 'resolucion.pdf',
    mimeType: 'application/pdf',
  };

  it('approves with the signed pdf, links the stored file and audits once', async () => {
    await registeredResolution();
    const { useCase, fileStorage } = build();

    const result = await useCase.execute({ actorId: 'user-2', resolutionId: 'r1', file });

    expect(result.status).toBe('APPROVED');
    const row = await prisma.resolution.findUniqueOrThrow({ where: { id: 'r1' } });
    expect(row.status).toBe('APPROVED');
    expect(row.approvedBy).toBe('user-2');
    expect(row.approvedAt).not.toBeNull();
    const stored = await prisma.storedFile.findUniqueOrThrow({
      where: { id: row.pdfFileId ?? '' },
    });
    expect(stored.mimeType).toBe('application/pdf');
    expect(stored.sizeBytes).toBe(PDF_CONTENT.length);
    expect(stored.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(fileStorage.hasFile(stored.publicId)).toBe(true);
    const audits = await prisma.auditLog.findMany({ where: { entity: 'Resolution' } });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe('STATE_CHANGE');
    expect(audits[0]?.entityId).toBe('r1');
  }, 20_000);

  it('rolls everything back and discards the file when a subscriber fails', async () => {
    await registeredResolution();
    const { useCase, fileStorage } = build([
      async () => {
        throw new Error('subscriber failed');
      },
    ]);

    await expect(useCase.execute({ actorId: 'user-2', resolutionId: 'r1', file })).rejects.toThrow(
      'subscriber failed',
    );

    const row = await prisma.resolution.findUniqueOrThrow({ where: { id: 'r1' } });
    expect(row.status).toBe('REGISTERED');
    expect(row.pdfFileId).toBeNull();
    expect(await prisma.storedFile.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { entity: 'Resolution' } })).toBe(0);
    expect(fileStorage.size).toBe(0);
  }, 20_000);

  it('lets exactly one of N simultaneous approvals win', async () => {
    await registeredResolution();
    const published = vi.fn(async () => undefined);
    const { useCase, fileStorage } = build([published]);

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) =>
        useCase.execute({ actorId: `user-${index + 1}`, resolutionId: 'r1', file }),
      ),
    );

    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(InvalidResolutionTransitionError);
    }
    const row = await prisma.resolution.findUniqueOrThrow({ where: { id: 'r1' } });
    expect(row.status).toBe('APPROVED');
    expect(await prisma.storedFile.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { entity: 'Resolution' } })).toBe(1);
    expect(published).toHaveBeenCalledTimes(1);
    expect(fileStorage.size).toBe(1);
  }, 20_000);

  it('answers 409 to an approval of an already approved resolution without changes', async () => {
    await registeredResolution();
    const { useCase, fileStorage } = build();
    await useCase.execute({ actorId: 'user-2', resolutionId: 'r1', file });
    const before = await prisma.resolution.findUniqueOrThrow({ where: { id: 'r1' } });

    await expect(
      useCase.execute({ actorId: 'user-3', resolutionId: 'r1', file }),
    ).rejects.toBeInstanceOf(InvalidResolutionTransitionError);

    const after = await prisma.resolution.findUniqueOrThrow({ where: { id: 'r1' } });
    expect(after.pdfFileId).toBe(before.pdfFileId);
    expect(after.approvedBy).toBe('user-2');
    expect(await prisma.storedFile.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { entity: 'Resolution' } })).toBe(1);
    expect(fileStorage.size).toBe(1);
  }, 20_000);
});
